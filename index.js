require('dotenv').config();
import {get} from 'lodash';
import cheerio from 'cheerio';
import got from 'got';
import logger from 'bristol';
import {CollegiateDictionary} from 'mw-dict';
import moment from 'moment';
import snoowrap from 'snoowrap';
import {argv} from 'yargs';

const {mwKey} = process.env;
const dictionary = new CollegiateDictionary(mwKey);
const random = Math.floor(Math.random() * (2000 - 0 + 1)) + 0;

let days = random;
let {word, shouldPost = true} = argv;
let hasSeedWord = !!word;

const date = moment().subtract(days, 'days').format('Y/MM/DD');
const today = moment().format('MMMM Do, Y');
const mwUrl = 'https://www.merriam-webster.com';
const redditBase = 'https://www.reddit.com/r/WordOfTheDay/search/.json?q=';
const redditOptions = '&restrict_sr=on&sort=relevance&t=all';
const configObj = {date, hasSeedWord, shouldPost, word};

logger.addTarget('console');
logger.info(`Using ${random} as a date seed`);

const getWord = async url => {
    logger.info('grabbing a word of the day from merriam-webster.com');
    const res = await got(url);
    const $ = cheerio.load(res.body);
    const wotd = $('.word-and-pronunciation h1').text();
    return wotd;
};

const getRedditResults = async word => {
    logger.info('checking reddit to see if word has been posted before');
    const url = `${redditBase}${word}${redditOptions}`;
    const res = await got(url, {json: true});
    const {children: results} = get(res, 'body.data', []);
    return results;
};

const startOver = () => {
    days++;
    const previousDay = moment().subtract(days, 'days').format('Y/MM/DD');
    const configObj = {
        date: previousDay,
        hasSeedWord: false,
        shouldPost,
        word: ''
    };

    main(configObj);
};

const cleanMeanings = (meanings = []) => {
    const joinedMeanings = meanings.length > 1 ? meanings.join(' ; ') : meanings[0];
    if (joinedMeanings) {
        const cleanedMeanings = joinedMeanings.replace(/:/g, '');
        return cleanedMeanings.trim();
    }

    return;
};

const main = async configObj => {
    let {hasSeedWord, word} = configObj;
    const {date, shouldPost} = configObj;

    if (!word) {
        word = await getWord(`${mwUrl}/word-of-the-day/${date}`);
    }

    logger.info(`found ${word} for ${hasSeedWord ? today : date}`);

    const attribution = `${mwUrl}/dictionary/${word}`;
    const redditResults = await getRedditResults(word);

    if (redditResults && redditResults.length === 0) {
        const result = await dictionary.lookup(word);

        if (!result) {
            logger.info('there was an error found within this definition object');
            startOver();
        }

        const [{
            definition: definitions = [],
            functional_label: type = '',
            popularity = ''
        }] = result;

        const popularityText = popularity ? `Popularity: ${popularity}\n\n` : '';
        let lastNumber = 1;
        let title = `${today} - ${word}`;
        let text = `_${type}_\n\n`;
        let defs = '';

        definitions.forEach((definition, i) => {
            const {meanings = []} = definition;
            const cleanedMeanings = cleanMeanings(meanings);
            if (cleanedMeanings) {
                if (i === 0) {
                    title = `${title} - ${cleanedMeanings}`;
                }

                defs = `${defs}${lastNumber}. ${cleanedMeanings}\n\n`;
                lastNumber++;
            }
        });

        text = `${text}${defs}${popularityText}[merriam-webster.com](${attribution})`;

        logger.info('title', title);
        logger.info('text', text);

        if (shouldPost) {
            const {clientId, clientSecret, redditUser: username, redditPass: password} = process.env;
            const r = new snoowrap({
                userAgent: 'reddit-bot-example-node',
                clientId,
                clientSecret,
                username,
                password
            });

            const postResult = await r.getSubreddit('wordoftheday').submitSelfpost({
                title,
                text
            });

            logger.info('posted word of the day to reddit!', postResult);
        }

        process.exit();
    } else {
        logger.info('word was already used in some capacity, go back another day');
        startOver();
    }
};

main(configObj);
