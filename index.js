require('dotenv').config();
import _ from 'lodash';
import cheerio from 'cheerio';
import got from 'got';
import logger from 'bristol';
import {CollegiateDictionary} from 'mw-dict';
import moment from 'moment';
import snoowrap from 'snoowrap';

const {mwKey} = process.env;
const dictionary = new CollegiateDictionary(mwKey);
const random = Math.floor(Math.random() * (2000 - 0 + 1)) + 0;
let days = random;

logger.addTarget('console');
logger.info(`Using ${random} as a date seed`);

const date = moment().subtract(days, 'days').format('Y/MM/DD');
const today = moment().format('MMMM Do, Y');
const mwUrl = 'https://www.merriam-webster.com';
const redditBase = 'https://www.reddit.com/r/WordOfTheDay/search/.json?q=';
const redditOptions = '&restrict_sr=on&sort=relevance&t=all';

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
    const {children: results} = _.get(res, 'body.data', []);
    return results;
};

const startOver = () => {
    days++;
    const previousDay = moment().subtract(days, 'days').format('Y/MM/DD');
    main(previousDay);
};

const main = async date => {
    const word = await getWord(`${mwUrl}/word-of-the-day/${date}`);
    logger.info(`found ${word} for ${date}`);
    const redditResults = await getRedditResults(word);
    if (redditResults && redditResults.length === 0) {
        dictionary.lookup(word).then(result => {
            const attribution = `${mwUrl}/dictionary/${word}`;
            const [{
                definition: definitions = [],
                functional_label: type = '',
                popularity = ''
            }] = result;

            const popularityText = popularity ? `Popularity: ${popularity}\n\n` : '';
            let lastNumber = 1;
            let title = `${today} - ${word}`;
            let text = `_${type}_`;
            let defs = '';

            definitions.forEach((definition, i) => {
                const {meanings = []} = definition;
                const joinedMeanings = meanings.length > 1 ? meanings.join(' ; ') : meanings[0];
                const cleanedMeanings = joinedMeanings.replace(':', '');
                if (cleanedMeanings) {
                    if (i === 0) {
                        title = `${title} - ${cleanedMeanings}`;
                    }

                    defs = `${defs}${lastNumber}.${cleanedMeanings}\n`;
                    lastNumber++;
                }
            });

            text = `${text}\n\n${defs}\n\n${popularityText}[merriam-webster.com](${attribution})`;

            logger.info('title', title);
            logger.info('text', text);

            const {clientId, clientSecret, redditUser: username, redditPass: password} = process.env;
            const r = new snoowrap({
                userAgent: 'reddit-bot-example-node',
                clientId,
                clientSecret,
                username,
                password
            });

            r.getSubreddit('wordoftheday').submitSelfpost({
                title,
                text
            });

            logger.info('posted word of the day to reddit!');
        }).catch(err => {
            logger.info('there was an error found within this definition object', err);
            startOver();
        });
    } else {
        logger.info('word was already used in some capacity, go back another day');
        startOver();
    }
};

main(date);
