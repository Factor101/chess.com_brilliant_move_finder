const Puppeteer = require('puppeteer');
const Process = require("process");
const ChessWebAPI = new (require('chess-web-api'))();
const readlineSync = require('readline-sync');
const useProxy = require('puppeteer-page-proxy');
const proxyCheck = require('nodejs-proxy-check');

let username;

const proxies = [].map(e => `http://${e}`);

(async () => {
    /*
    username = readlineSync.question( "Enter your Chess.com username: ");
    const year = readlineSync.question( "Enter what year you want to import games from: ");
    const month = readlineSync.question( "Enter what month you want to import games from, as a number: ");
    */
    for(const e of proxies) {
        break;
        const proxy = {
            host: e.match(/http:\/\/(.*)/)[1].split(":")[0],
            port: Number(e.match(/http:\/\/(.*)/)[1].split(":")[1]),
            type: "HTTP"
        };
        console.log(proxy)
        await proxyCheck(proxy).then(r => {
            console.log(r); // true
        }).catch(e => {
            console.error(e); // ECONNRESET
        });
    }

    username = "Factor101";
    let year = 2022;
    let month = 11;

    const res = await ChessWebAPI.getPlayerCompleteMonthlyArchives(
        username,
        year,
        month
    ).catch(err => {
        console.error(err.message);
        Process.exit(-1);
    });

    // noinspection JSUnresolvedVariable
    const games = res.body.games.reverse();
    const brilliantGames = [];

    const browser = await Puppeteer.launch({
        headless: true,
        args: ['--disable-web-security', "--no-sandbox"],
        defaultViewport: null
    });

    console.log("[x] Starting to analyze games...");

    let i = 0;
    for (const e of games)
    {
        const page = await browser.newPage();
        await useProxy(page, proxies[Math.floor(Math.random() * proxies.length)]);
        console.log(`[x] Analyzing game ${i + 1} of ${games.length} (${((i + 1) / games.length * 100).toString().replace(/(?<=\.)(\d+)(?<=\d{3,})$/, (matched, group) => group.substr(0, 2))} % complete)...`);
        await page.goto(`https://www.chess.com/analysis/game/live/${e.url.match(/\/(\d+)$/)[1]}?tab=review`);

        let tries = 0;
        let failed = false;
        while(
            !(await page.evaluate(
                () => document.querySelectorAll(".review-view-section.review-view-movelist").length !== 0
            ))
        ) {
            await page.waitForTimeout(1000);
            if(++tries >= 10) {
                console.log(`\t[x] Failed to load analysis for game ${++i} of ${games.length}...`);
                failed = true;
                break;
            }
        }
        if(failed) {
            await page.close();
            continue;
        }

        const nBrilliantMoves = await page.evaluate(() => document.querySelectorAll(".move-list-node-text.analysis-brilliant").length);
        if(nBrilliantMoves !== 0) {
            // noinspection JSUnresolvedVariable
            brilliantGames.push(new Game(e.url, e.pgn, e.time_control, e.time_class, e.rated, e.accuracies, nBrilliantMoves));
            console.log(`\t[>] Game ${i + 1} of ${games.length} has ${nBrilliantMoves} brilliant move${nBrilliantMoves > 1 ? 's' : ''}!`);
        }
        await page.close();
        i++;
    }
    await browser.close();

    console.log("[x] Finished analyzing games!");
    console.log("----------------------------------------");
    brilliantGames.forEach((e, i) => {
        console.log(
            `[x] #${i + 1} - ${e.nBrilliantMoves} brilliant moves` +
            ` | Vs. ${e.opponent}` +
            ` | Result: ${e.result}` +
            ` | ${e.getTimeControlPrintable()} ${e.timeClass}` +
            ` | ${e.rated ? "Rated" : "Unrated"}` +
            ` | Accuracy: ${e.playerAccuracy}%` +
            ` | (url: ${e.url})`
        );
    });
})();

/**
 * @constructor
 *
 * @property {string} url
 * @property {string} pgn
 * @property {string} timeControl - Time control of game, formatted as Seconds+Increment
 * @property {string} timeClass - Time class of game e.g. rapid, blitz, bullet, correspondence
 * @property {boolean} rated - Whether the game was rated
 * @property {Object<white: float, black: float>} accuracies - Accuracy of each player
 * @property {"White" | "Black"} playerColor - Color of the player in game
 * @property {"Win" | "Loss" | "Draw"} result - Result of the game
 * @property {number} nBrilliantMoves - Number of brilliant moves in the game
 * @property {float} accuracy - Accuracy of the player in game
 * @property {string} opponent - Username of the opponent
 *
 * @method {string} getTimeControlPrintable - Returns a printable version of the time control
 *
 *
 * @returns {Game}
 */
function Game(url, pgn, timeControl, timeClass, rated, accuracies, nBrilliantMoves)
{
    initializer(this, arguments);
    this.playerColor = (new RegExp(`\\[White\\s"${username}"\]$`, "mi")).test(pgn) ? "White" : "Black";
    this.result = pgn.match(/\[Result\s"(\d\/?\d?)-(\d\/?\d?)"]/mi)[1] === "1" ? this.playerColor === "White" ? "Win" : "Loss" : "Draw";
    this.timeClass = this.timeClass.charAt(0).toUpperCase() + this.timeClass.slice(1);
    this.playerAccuracy = parseFloat(accuracies[this.playerColor.toLowerCase()].toString().replace(/\.0+$/, ""));
    this.opponent = (new RegExp(`\\[${this.playerColor === "White" ? "Black" : "White"}\\s"([a-z0-9_\\-]+)"\]$`, "mi")).exec(pgn)[1];

    this.getTimeControlPrintable = function()
    {
        const times = this.timeControl.match(/(\d+)/g);
        const minutes = Math.floor(times[0] / 60);
        const seconds = times[0] - (minutes * 60);

        return seconds !== 0 ? `${minutes}m ${seconds}s + ${times[1]}s` : `${minutes}m + ${times[1]}s`;
    }
}

/**
 *
 * @description defines the arguments provided to a constructor as properties of the object being constructed (initializer list)
 *
 * @param {Object} instance - instance of an object
 * @param {IArguments} passedArgs - arguments passed to the object's constructor
 *
 */
function initializer(instance, passedArgs)
{
    /\(([\w\s,]*)\)/gmi.exec(instance.constructor.toString())[1]
        .split(", ").forEach(function(e, i) {
            instance[e] = passedArgs[i];
        });
}
