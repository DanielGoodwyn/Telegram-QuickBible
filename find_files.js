const https = require('https');

const repos = [
    { owner: 'DanielGoodwyn', repo: 'Web-QuickBible', branch: 'master' },
    { owner: 'thiagobodruk', repo: 'bible', branch: 'master' }
];

repos.forEach(target => {
    const options = {
        hostname: 'api.github.com',
        path: `/repos/${target.owner}/${target.repo}/git/trees/${target.branch}?recursive=1`,
        headers: { 'User-Agent': 'Node.js' }
    };

    https.get(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                if (json.tree) {
                    console.log(`\n--- Files in ${target.owner}/${target.repo} ---`);
                    json.tree.slice(0, 20).forEach(f => console.log(f.path));

                    // Also try to find anything looking like "web" or "bible"
                    const webFiles = json.tree.filter(f => f.path.match(/web/i) || f.path.match(/bible/i));
                    console.log("-- Potential Matches --");
                    webFiles.slice(0, 10).forEach(f => console.log(f.path));
                }
            } catch (e) { }
        });
    }).on('error', () => { });
});
