#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Parser from 'rss-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_FILE = path.join(__dirname, 'news.json');
const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

const FEEDS = {
    Politik: [
        {
            source: 'ZEIT Politik',
            url: 'https://newsfeed.zeit.de/politik/index'
        },
        {
            source: 'Süddeutsche Zeitung Politik',
            url: 'https://rss.sueddeutsche.de/rss/Politik'
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
        }
    ],
    Gesellschaft: [
        {
            source: 'Squirrel News Gesellschaft',
            url: 'https://squirrel-news.net/feed'
        },
        {
            source: 'Süddeutsche Zeitung Leben',
            url: 'https://rss.sueddeutsche.de/rss/leben'
        },
        {
            source: 'ZEIT Gesellschaft',
            url: 'https://newsfeed.zeit.de/gesellschaft/index'
        }
    ],
    Sport: [
        {
            source: 'Süddeutsche Zeitung Sport',
            url: 'https://rss.sueddeutsche.de/rss/Sport'
        },
        {
            source: 'kicker',
            url: 'https://newsfeed.kicker.de/news/aktuell'
        }
    ]
};

const ARTICLES_PER_CATEGORY = 30;

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
        .replace(/<br\s*\/?>(?=\s*<br\s*\/?>(\s*<br\s*\/?>)*)/gi, '\n')
        .replace(/<br\s*\/?>(?!\s*<br\s*\/?>(\s*<br\s*\/?>)*)/gi, '\n')
        .replace(/<(\/)?(p|div|section|article|blockquote|li|ul|ol|header|footer|h[1-6])>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\r/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
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

function toParagraphs(text = '') {
    if (!text) {
        return [];
    }
    return text
        .replace(/\r/g, '')
        .split(/\n{2,}/)
        .map(paragraph => paragraph.trim())
        .filter(Boolean);
}


function extractFullText(bodySource = '', fallback = '') {
    const bodyText = stripHtml(bodySource);
    if (bodyText) {
        return bodyText;
    }

    const fallbackText = stripHtml(fallback);
    if (fallbackText) {
        return fallbackText;
    }

    return '';
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

    const fullText = extractFullText(bodySource, summarySource);
    const paragraphs = toParagraphs(fullText);
    const summary = fullText || 'Keine weiteren Details verfügbar.';

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

    await fs.writeFile(OUTPUT_FILE, JSON.stringify(payload, null, 2), 'utf8');

    console.log(`News aktualisiert (${new Date(payload.updatedAt).toLocaleString('de-DE')}), Dauer ${(Date.now() - start)}ms`);
}

async function ensureInitialFile() {
    try {
        await fs.access(OUTPUT_FILE);
    } catch (error) {
        await fs.writeFile(OUTPUT_FILE, JSON.stringify({ updatedAt: null, categories: {} }, null, 2), 'utf8');
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
