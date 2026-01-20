
import { bibleService } from './src/services/bibleService';

console.log('--- Testing Bible Service ---');

// Test 1: Random Verse
console.log('\nRandom Verse:');
console.log(bibleService.getRandomVerse());

// Test 2: Specific Verse (John 3:16)
console.log('Books:', bibleService.getBooks());
console.log('\nSpecific Verse (John 3:16):');
console.log(bibleService.getVerse('John', 3, 16));

// Test 3: Search
console.log('\nSearch for "Jesus wept":');
console.log(bibleService.search('Jesus wept'));

// Test 4: Search for "In the beginning"
console.log('\nSearch for "In the beginning":');
console.log(bibleService.search('In the beginning', 3));
