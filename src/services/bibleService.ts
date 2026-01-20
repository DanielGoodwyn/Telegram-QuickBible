import * as fs from 'fs';
import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';

export interface Verse {
    book: string;
    chapter: number;
    verse: number;
    text: string;
}

interface XmlBook {
    h: string; // Book name
    c: XmlChapter[];
}

interface XmlChapter {
    v: (string | object)[]; // Verses might be objects if mix content
}

export class BibleService {
    private verses: Verse[] = [];
    private books: string[] = [];
    private booksMap: Map<string, string> = new Map(); // Normalization map

    // Cross References
    // Key: "Book Chapter:Verse" (e.g. "Genesis 1:1")
    // Value: Array of structured refs sorted by votes
    private crossRefs: Map<string, { display: string, linkCmd: string, votes: number }[]> = new Map();

    // Abbreviation Map for OpenBible data
    private abbrMap: { [key: string]: string } = {
        "Gen": "Genesis", "Exod": "Exodus", "Lev": "Leviticus", "Num": "Numbers", "Deut": "Deuteronomy",
        "Josh": "Joshua", "Judg": "Judges", "Ruth": "Ruth", "1Sam": "1 Samuel", "2Sam": "2 Samuel",
        "1Kgs": "1 Kings", "2Kgs": "2 Kings", "1Chr": "1 Chronicles", "2Chr": "2 Chronicles", "Ezra": "Ezra",
        "Neh": "Nehemiah", "Esth": "Esther", "Job": "Job", "Ps": "Psalms", "Prov": "Proverbs",
        "Eccl": "Ecclesiastes", "Song": "Song of Solomon", "Isa": "Isaiah", "Jer": "Jeremiah", "Lam": "Lamentations",
        "Ezek": "Ezekiel", "Dan": "Daniel", "Hos": "Hosea", "Joel": "Joel", "Amos": "Amos",
        "Obad": "Obadiah", "Jonah": "Jonah", "Mic": "Micah", "Nah": "Nahum", "Hab": "Habakkuk",
        "Zeph": "Zephaniah", "Hag": "Haggai", "Zech": "Zechariah", "Mal": "Malachi", "Matt": "Matthew",
        "Mark": "Mark", "Luke": "Luke", "John": "John", "Acts": "Acts", "Rom": "Romans",
        "1Cor": "1 Corinthians", "2Cor": "2 Corinthians", "Gal": "Galatians", "Eph": "Ephesians", "Phil": "Philippians",
        "Col": "Colossians", "1Thess": "1 Thessalonians", "2Thess": "2 Thessalonians", "1Tim": "1 Timothy", "2Tim": "2 Timothy",
        "Titus": "Titus", "Phlm": "Philemon", "Heb": "Hebrews", "Jas": "James", "1Pet": "1 Peter",
        "2Pet": "2 Peter", "1John": "1 John", "2John": "2 John", "3John": "3 John", "Jude": "Jude", "Rev": "Revelation"
    };

    constructor() {
        this.loadBibleData();
        this.loadCrossReferences();
    }

    private loadBibleData() {
        try {
            const xmlPath = path.resolve(process.cwd(), 'web.xml');
            console.log('Loading Bible data from:', xmlPath);

            if (!fs.existsSync(xmlPath)) {
                console.error("web.xml not found at", xmlPath);
                return;
            }

            const xmlData = fs.readFileSync(xmlPath, 'utf-8');
            const parser = new XMLParser({
                ignoreAttributes: true,
                isArray: (name) => ['book', 'c', 'v'].includes(name)
            });

            const result = parser.parse(xmlData);

            if (!result.bible || !result.bible.book) {
                console.error("Invalid XML structure");
                return;
            }

            const books = result.bible.book as XmlBook[];

            books.forEach((book) => {
                this.books.push(book.h);
                this.booksMap.set(book.h.toLowerCase(), book.h);

                const bookName = book.h;

                book.c.forEach((chapter, chapterIndex) => {
                    const chapterNum = chapterIndex + 1;

                    if (!chapter.v) return;

                    chapter.v.forEach((verseItem) => {
                        let verseText = '';

                        if (typeof verseItem === 'string') {
                            verseText = verseItem;
                        } else if (typeof verseItem === 'number') {
                            verseText = String(verseItem);
                        } else {
                            return;
                        }

                        const firstSpace = verseText.indexOf(' ');
                        if (firstSpace === -1) return;

                        const verseNumStr = verseText.substring(0, firstSpace).replace('.', '');
                        const text = verseText.substring(firstSpace + 1);
                        const verseNum = parseInt(verseNumStr);

                        if (!isNaN(verseNum)) {
                            this.verses.push({
                                book: bookName,
                                chapter: chapterNum,
                                verse: verseNum,
                                text: text
                            });
                        }
                    });
                });
            });
            console.log(`Loaded ${this.verses.length} verses from ${this.books.length} books.`);
        } catch (error) {
            console.error('Failed to load Bible data:', error);
        }
    }

    private parseRefPart(refPart: string): { book: string, ch: number, v: number, bookAbbr: string } | null {
        const p = refPart.split('.');
        if (p.length < 3) return null;
        const abbr = p[0];
        const ch = parseInt(p[1]);
        const v = parseInt(p[2]);
        const book = this.abbrMap[abbr];
        if (!book || isNaN(ch) || isNaN(v)) return null;
        return { book, ch, v, bookAbbr: abbr };
    }

    private loadCrossReferences() {
        try {
            const refsPath = path.resolve(process.cwd(), 'cross_references.txt');
            if (!fs.existsSync(refsPath)) {
                console.warn("cross_references.txt not found. Cross References feature will be empty.");
                return;
            }

            console.log("Loading Cross References...");
            const data = fs.readFileSync(refsPath, 'utf-8');
            const lines = data.split('\n');

            let count = 0;

            // Format: Gen.1.1	Ps.121.2	62
            // Or range: Gen.1.1	John.1.1-John.1.3	354
            for (const line of lines) {
                const parts = line.split('\t');
                if (parts.length < 3) continue;

                const fromStr = parts[0];
                const toStr = parts[1];
                const votes = parseInt(parts[2]);

                // Parse Source "fromStr" (assuming source usually single verse, but handle range just in case by taking start)
                const fromRangeParts = fromStr.split('-');
                const fromStart = this.parseRefPart(fromRangeParts[0]);

                if (!fromStart) continue;

                // Parse Target "toStr"
                let displayStr = "";
                let linkCmd = "";

                const toRangeParts = toStr.split('-');
                const toStart = this.parseRefPart(toRangeParts[0]);

                if (!toStart) continue;

                // Construct Link Command: /v_Book_Ch_V
                linkCmd = `/v_${toStart.book.replace(/ /g, '_')}_${toStart.ch}_${toStart.v}`;

                // Construct Display String
                if (toRangeParts.length > 1) {
                    // It's a range
                    const toEnd = this.parseRefPart(toRangeParts[1]);
                    if (toEnd) {
                        if (toEnd.book === toStart.book && toEnd.ch === toStart.ch) {
                            // Same book & chapter: John 1:1-3
                            displayStr = `${toStart.book} ${toStart.ch}:${toStart.v}-${toEnd.v}`;
                        } else if (toEnd.book === toStart.book) {
                            // Same book, diff chapter: John 1:1-2:4
                            displayStr = `${toStart.book} ${toStart.ch}:${toStart.v}-${toEnd.ch}:${toEnd.v}`;
                        } else {
                            // diff book? Rare
                            displayStr = `${toStart.book} ${toStart.ch}:${toStart.v} - ${toEnd.book} ${toEnd.ch}:${toEnd.v}`;
                        }
                    } else {
                        // Fallback if parse failed
                        displayStr = `${toStart.book} ${toStart.ch}:${toStart.v}`;
                    }
                } else {
                    // Single verse
                    displayStr = `${toStart.book} ${toStart.ch}:${toStart.v}`;
                }

                const key = `${fromStart.book} ${fromStart.ch}:${fromStart.v}`;

                if (!this.crossRefs.has(key)) {
                    this.crossRefs.set(key, []);
                }

                // Add to list
                this.crossRefs.get(key)!.push({
                    display: displayStr,
                    linkCmd: linkCmd,
                    votes: votes
                });

                count++;
            }

            // Sort all lists by votes descending
            this.crossRefs.forEach((list) => {
                list.sort((a, b) => b.votes - a.votes);
            });

            console.log(`Loaded ${count} cross-reference connections.`);
        } catch (err) {
            console.error("Failed to load cross references:", err);
        }
    }

    getVerse(book: string, chapter: number, verse: number): Verse | undefined {
        // Try exact match
        let found = this.verses.find(
            (v) =>
                v.book.toLowerCase() === book.toLowerCase() &&
                v.chapter === chapter &&
                v.verse === verse
        );

        if (found) return found;

        // Try finding book part match
        const bookMatch = this.books.find(b => b.toLowerCase().includes(book.toLowerCase()));
        if (bookMatch) {
            return this.verses.find(
                (v) =>
                    v.book === bookMatch &&
                    v.chapter === chapter &&
                    v.verse === verse
            );
        }

        return undefined;
    }

    search(query: string): Verse[] {
        let raw = query.trim();
        // Normalize smart quotes to straight quotes
        raw = raw.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');

        // Check if quoted (starts and ends with " or ')
        const isQuoted = /^["'].*["']$/.test(raw);

        if (isQuoted) {
            // Phrase Search: Strip quotes and match exact substring
            const cleanQuery = raw.replace(/^["']|["']$/g, "").toLowerCase();
            return this.verses
                .filter((v) => v.text.toLowerCase().includes(cleanQuery));
        } else {
            // Keyword Search: Match ALL words (order doesn't matter)
            const terms = raw.toLowerCase().split(/\s+/);
            return this.verses
                .filter((v) => {
                    const text = v.text.toLowerCase();
                    return terms.every(term => text.includes(term));
                });
        }
    }

    getRandomVerse(): Verse {
        if (this.verses.length === 0) {
            return { book: "Error", chapter: 1, verse: 1, text: "No verses loaded." };
        }
        const randomIndex = Math.floor(Math.random() * this.verses.length);
        return this.verses[randomIndex];
    }

    getNextVerse(v: Verse): Verse | undefined {
        const index = this.verses.findIndex(item =>
            item.book === v.book && item.chapter === v.chapter && item.verse === v.verse
        );
        if (index === -1 || index === this.verses.length - 1) return undefined;
        return this.verses[index + 1];
    }

    getPreviousVerse(v: Verse): Verse | undefined {
        const index = this.verses.findIndex(item =>
            item.book === v.book && item.chapter === v.chapter && item.verse === v.verse
        );
        if (index === -1 || index === 0) return undefined;
        return this.verses[index - 1];
    }

    getBooks(): string[] {
        return this.books;
    }

    getBookId(bookName: string): number | undefined {
        const index = this.books.findIndex(b => b.toLowerCase() === bookName.toLowerCase());
        if (index === -1) {
            // Try fuzzy match
            const keys = Array.from(this.booksMap.keys());
            const match = keys.find(k => k.includes(bookName.toLowerCase()));
            if (match) {
                const realName = this.booksMap.get(match);
                return this.books.indexOf(realName!) + 1;
            }
            return undefined;
        }
        return index + 1;
    }

    getChapterLastVerse(bookName: string, chapter: number): number | undefined {
        let realBookName = this.books.find(b => b.toLowerCase() === bookName.toLowerCase());
        if (!realBookName) {
            const keys = Array.from(this.booksMap.keys());
            const match = keys.find(k => k.includes(bookName.toLowerCase()));
            if (match) realBookName = this.booksMap.get(match);
        }

        if (!realBookName) return undefined;

        const chapterVerses = this.verses.filter(v =>
            v.book === realBookName && v.chapter === chapter
        );

        if (chapterVerses.length === 0) return undefined;

        return Math.max(...chapterVerses.map(v => v.verse));
    }

    getBibleHubUrl(bookName: string, chapter: number, verse: number): string | undefined {
        const bookId = this.getBookId(bookName);
        if (!bookId) return undefined;

        const realName = this.books[bookId - 1];
        let slug = realName.toLowerCase();

        if (slug === "song of solomon") {
            slug = "songs";
        } else {
            slug = slug.replace(/ /g, "_");
        }

        return `https://biblehub.com/${slug}/${chapter}-${verse}.htm`;
    }

    getCrossReferences(bookName: string, chapter: number, verse: number): { display: string, linkCmd: string, votes: number }[] {
        // Resolve name
        let realBookName = this.books.find(b => b.toLowerCase() === bookName.toLowerCase());
        if (!realBookName) {
            const keys = Array.from(this.booksMap.keys());
            const match = keys.find(k => k.includes(bookName.toLowerCase()));
            if (match) realBookName = this.booksMap.get(match);
        }
        if (!realBookName) return [];

        const key = `${realBookName} ${chapter}:${verse}`;
        return this.crossRefs.get(key) || [];
    }
}

export const bibleService = new BibleService();
