require('dotenv').config();

const cheerio = require('cheerio');
const got = require('got');
const moment = require('moment');
const wd = require('word-definition');
const snoowrap = require('snoowrap');

let days = 730;

const date = moment().subtract(days, 'days').format('Y/MM/DD');
const today = moment().format('MMMM Do, Y');
const base = 'http://www.dictionary.com';
const redditBase = 'https://www.reddit.com/r/WordOfTheDay/search/.json?q=';
const redditOptions = '&restrict_sr=on&sort=relevance&t=all';

const r = new snoowrap({
    userAgent: 'reddit-bot-example-node',
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    username: process.env.REDDIT_USER,
    password: process.env.REDDIT_PASS
});

const getWord = async url => {
    console.log('grabbing a word of the day from dictionary.com');
    try {
        const res = await got(url);
        const $ = cheerio.load(res.body);
        const wotd = $('.definition-header strong').text();
        return wotd;
    } catch(ex) {
        console.log(ex);
    }
}

const checkReddit = async word => {
    console.log('checking reddit to see if word has been posted before');
    const url = `${redditBase}${word}${redditOptions}`;

    try {
        const res = await got(url, {json: true});
        return res.body.data.children;
    } catch(ex) {
        console.log(ex);
    }
}

const startOver = () => {
    days++;
    const previousDay = moment().subtract(days, 'days').format('Y/MM/DD');
    main(previousDay);
}

const main = async date => {
    try {
        const word = await getWord(`${base}/wordoftheday/${date}`);
        console.log(`found ${word} for ${date}`);
        const reddit = await checkReddit(word);

        if (reddit.length === 0) {
            wd.getDef(word, 'en', null, res => {
                if (!res.err) {
                    const {category, definition} = res;
                    const attribution = `https://en.wiktionary.org/wiki/${word}`;
                    const title = `${today} - ${word} - ${definition}`;
                    const text = `_${category}_\n\n${definition}\n\n[wiktionary.org](${attribution})`;

                    console.log('title', title);
                    console.log('text', text);

                    r.getSubreddit('wordoftheday')
                    .submitSelfpost({
                         title,
                         text
                    });

                    console.log('posted word of the day to reddit!');
                } else {
                    console.log('there was an error found within this definition object');
                    startOver();
                }
            });
        } else {
            console.log('word was already used in some capacity, go back another day');
            startOver();
        }
    } catch(ex) {
        console.log(ex);
    }
}

main(date);
