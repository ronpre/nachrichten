#!/usr/bin/env node
const fs = require('fs/promises');
const path = require('path');
const Parser = require('rss-parser');

const OUTPUT_FILE = path.join(__dirname, 'news.json');
const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

const FEEDS = {
    Politik: [
        {
            source: 'ZEIT Politik',
            url: 'https://newsfeed.zeit.de/politik/index'
        },
        {
            source: 'SPIEGEL Politik',
            url: 'https://www.spiegel.de/politik/index.rss'
        }
    ],
    Wirtschaft: [
        {
            source: 'Handelsblatt',
            url: 'https://www.handelsblatt.com/contentexport/feed/wirtschaft'
        },
        {
            source: 'ZEIT Wirtschaft',
            url: 'https://newsfeed.zeit.de/wirtschaft/index'
        }
    ],
    Gesellschaft: [
        {
            source: 'ZEIT Gesellschaft',
            url: 'https://newsfeed.zeit.de/gesellschaft/index'
        },
        {
            source: 'SPIEGEL Panorama',
            url: 'https://www.spiegel.de/panorama/index.rss'
        }
    ],
    Sport: [
        {
            source: 'Süddeutsche Zeitung Sport',
            url: 'https://rss.sueddeutsche.de/rss/Sport'
        },
        {
            source: 'Sportschau',
            url: 'https://www.sportschau.de/sportschauindex100~_type-rss.feed'
        }
    ]
};

const ARTICLES_PER_CATEGORY = 15;

const parser = new Parser({
    timeout: 15000,
    headers: {
        'User-Agent': 'NachrichtenDashboard/1.0 (rp@example.com)'
    }
});

function stripHtml(input = '') {
    return input
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/[\t\r\n]+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function normalizeWhitespace(text = '') {
    return text.replace(/\s+/g, ' ').trim();
}

function toIsoDate(value) {
    if (!value) {
        return null;
    }
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) {
        return null;
    }
    return new Date(timestamp).toISOString();
}

function summarize(text = '', maxSentences = 4, maxChars = 900) {
    const clean = normalizeWhitespace(text);
    if (!clean) {
        return '';
    }
    const sentences = clean.split(/(?<=[.!?])\s+/);
    const summary = sentences.slice(0, maxSentences).join(' ');
    if (summary.length <= maxChars) {
        return summary;
    }
    return summary.slice(0, maxChars - 1).trimEnd() + '…';
}

function toParagraphs(text = '') {
    const clean = stripHtml(text);
    if (!clean) {
        return [];
    }
    return clean
        .split(/\n{2,}|(?<=\.)\s{2,}/)
        .map(paragraph => paragraph.trim())
        .filter(Boolean);
}

function buildDetailedSummary(paragraphs = [], fallback = '') {
    const pieces = [];

    if (Array.isArray(paragraphs) && paragraphs.length > 0) {
        const sliceEnd = Math.min(5, paragraphs.length);
        pieces.push(paragraphs.slice(0, sliceEnd).join(' '));
    }

    if (fallback) {
        const fallbackSummary = summarize(fallback, 4, 900);
        if (fallbackSummary) {
            pieces.push(fallbackSummary);
        }
    }

    const combined = normalizeWhitespace(pieces.join(' '));
    if (!combined) {
        return '';
    }

    if (combined.length <= 1400) {
        return combined;
    }

    return combined.slice(0, 1397).trimEnd() + '…';
}

async function fetchFeed(feed) {
    try {
        const data = await parser.parseURL(feed.url);
        return data.items.map(item => ({ item, feed }));
    } catch (error) {
        console.error(`Feed konnte nicht geladen werden (${feed.source} - ${feed.url}):`, error.message);
        return [];
    }
}

function dedupeByTitle(entries) {
    const seen = new Set();
    return entries.filter(({ item }) => {
        const title = item.title ? normalizeWhitespace(item.title).toLowerCase() : '';
        if (!title || seen.has(title)) {
            return false;
        }
        seen.add(title);
        return true;
    });
}

function buildArticle({ item, feed }) {
    const title = normalizeWhitespace(item.title || 'Ohne Titel');
    const summarySource = item.contentSnippet || item.summary || item.content || '';
    const bodySource = item['content:encoded'] || item.content || summarySource;

    const paragraphs = toParagraphs(bodySource);
    const summary = buildDetailedSummary(paragraphs, summarySource);

    return {
        id: item.guid || item.id || item.link || title,
        title,
        summary,
        paragraphs,
        link: item.link || '',
        source: feed.source,
        publishedAt: toIsoDate(item.isoDate || item.pubDate) || new Date().toISOString()
    };
}

async function collectCategory(category, feeds, limit = ARTICLES_PER_CATEGORY) {
    const allEntries = (await Promise.all(feeds.map(fetchFeed))).flat();
    const deduped = dedupeByTitle(allEntries);
    const articles = deduped
        .map(buildArticle)
        .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
        .slice(0, limit);
    return articles;
}

async function updateNews() {
    const start = Date.now();
    const categories = {};
    for (const [category, feeds] of Object.entries(FEEDS)) {
        categories[category] = await collectCategory(category, feeds);
    }

    const payload = {
        updatedAt: new Date().toISOString(),
        categories
    };

    await fs.writeFile(OUTPUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');

    console.log(`News aktualisiert (${new Date(payload.updatedAt).toLocaleString('de-DE')}), Dauer ${(Date.now() - start)}ms`);
}

async function ensureInitialFile() {
    try {
        await fs.access(OUTPUT_FILE);
    } catch (error) {
        await fs.writeFile(OUTPUT_FILE, JSON.stringify({ updatedAt: null, categories: {} }, null, 2), 'utf-8');
    }
}

(async () => {
    await ensureInitialFile();
    await updateNews();

    if (process.argv.includes('--watch')) {
        console.log('Starte 60-Minuten-Intervall für automatische Aktualisierung.');
        setInterval(() => {
            updateNews().catch(error => console.error('Aktualisierung fehlgeschlagen:', error));
        }, UPDATE_INTERVAL_MS);
    }
})();
