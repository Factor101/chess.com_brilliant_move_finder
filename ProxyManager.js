const proxyCheck = require("nodejs-proxy-check");
const Process = require("process");
const fs = require("fs");

module.exports = {
    /**
     * @constructor
     */
    ProxyManager: function() {
        /**
         * @constructor
         * @typedef {host: string, port: string, type: "http" | "https" | "socks4" | "socks5", isAlive: boolean} Proxy
         *
         * @param {string} host - Address of proxy
         * @param {number | string} port - Port of proxy
         * @param {"http" | "https" | "socks4" | "socks5"} type - Type of proxy
         *
         * @property {string} host - Address of proxy
         * @property {string} port - Port of proxy
         * @property {"http" | "https" | "socks4" | "socks5"} type - Type of proxy
         * @property {boolean} isAlive
         *
         * @method {string} toString - Returns a URL version of the proxy
         *
         * @returns Proxy
         */
        this.Proxy = function(host, port, type) {
            this.host = host;
            this.port = typeof port === "string" ? port : port.toString();
            this.type = type;
            this.isAlive = true;

            this.toString = function() {
                return `${this.type.toLowerCase()}://${this.host}:${this.port}`
            }
        }

        /**
         * @type {ProxyManager.Proxy[]}
         */
        this.proxies = [];

        this.Pool = {
            /**
             * @type {Proxy[]}
             */
            poolList: [],
            index: -1,
            loopOnEmpty: true,

            /**
             *
             *
             * @returns {Proxy | undefined}
             */
            getProxy: () => {
                if(++this.Pool.index >= this.Pool.poolList.length) {
                    if(this.Pool.loopOnEmpty) {
                        console.log("[PROXY MANAGER]: Pool out of proxies! Restarting at 0...");
                        this.Pool.index = 0;
                    } else {
                        console.log("[PROXY MANAGER]: Pool out of proxies!");
                        return;
                    }

                }

                return this.Pool.poolList[this.Pool.index];
            },

            /**
             *
             * @param {ProxyManager.Proxy} deadProxy
             */
            removeProxy: (deadProxy) => {
                deadProxy.isAlive = false;
                this.Pool.poolList.splice(this.Pool.poolList.findIndex(e => e.host === deadProxy.host && e.port === deadProxy.port), 1);
            },

            refresh: () => {
                this.Pool.poolList = deepCopy(this.proxies);
                this.Pool.index = -1;
            },

            refreshAliveOnly: () => {
                this.Pool.poolList = deepCopy(this.proxies).filter(e => e.isAlive);
                this.Pool.index = -1;
            },

            /**
             * @returns {Object<alive: number, dead: number>}
             */
            getAmounts: () => {
                const amountAlive = this.poolList.reduce((a, b) => a + b.isAlive ? 1 : 0, 0);
                return {
                    alive: amountAlive,
                    dead: this.Pool.poolList.length - amountAlive
                }
            },

            /**
             * @returns {boolean}
             */
            hasProxies: () => {
                return this.Pool.index < this.Pool.poolList.length - 1;
            }
        }
        ;

        /**
         * @param {"http" | "https" | "socks4" | "socks5"} type - Type of proxy
         */
        this.load = function(type) {
            if(!fs.existsSync("proxies.txt")) {
                console.log("[ERR] You must have a proxies.txt folder in the directory of your index.js file.");
                Process.exit(-1);
            }

            this.proxies = fs.readFileSync("proxies.txt", "utf-8").split('\n').map(e => {
                const parts = e.match(/(.*)/)[1].split(":");
                return new this.Proxy(
                    parts[0],
                    parts[1],
                    "http"
                )
            });

            this.Pool.poolList = this.proxies;

            if(this.proxies.length === 0) {
                console.error("[ERR] You must have proxies in your proxies.txt file.");
                Process.exit(-1);
            }
        };
    }
};

function deepCopy(obj)
{
    const res = Array.isArray(obj) ? [] : {};

    for (const key in obj)
    {
        const val = obj[key];
        res[key] = (typeof val === "object") ? deepCopy(val) : val;
    }

    return res;
}