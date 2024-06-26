"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unfurl = void 0;
const htmlparser2_1 = require("htmlparser2");
const node_fetch_1 = __importDefault(require("node-fetch"));
const unexpectedError_1 = __importDefault(require("./unexpectedError"));
const schema_1 = require("./schema");
const he_1 = require("he");
const iconv_lite_1 = require("iconv-lite");
const defaultHeaders = {
    Accept: "text/html, application/xhtml+xml",
    "User-Agent": "facebookexternalhit",
};
function unfurl(url, opts) {
    if (opts === undefined) {
        opts = {};
    }
    if (opts.constructor.name !== "Object") {
        throw new unexpectedError_1.default(unexpectedError_1.default.BAD_OPTIONS);
    }
    typeof opts.oembed === "boolean" || (opts.oembed = true);
    typeof opts.compress === "boolean" || (opts.compress = true);
    typeof opts.headers === "object" || (opts.headers = defaultHeaders);
    Number.isInteger(opts.follow) || (opts.follow = 50);
    Number.isInteger(opts.timeout) || (opts.timeout = 0);
    Number.isInteger(opts.size) || (opts.size = 0);
    return getPage(url, opts)
        .then(getMetadata(url, opts))
        .then(getRemoteMetadata(url, opts))
        .then(parse(url));
}
exports.unfurl = unfurl;
async function getPage(url, opts) {
    const res = await (opts.fetch
        ? opts.fetch(url)
        : (0, node_fetch_1.default)(new URL(url), {
            headers: opts.headers,
            size: opts.size,
            follow: opts.follow,
            timeout: opts.timeout,
        }));
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("Content-Type");
    const contentLength = res.headers.get("Content-Length");
    if (res.status !== 200) {
        throw new unexpectedError_1.default({
            ...unexpectedError_1.default.BAD_HTTP_STATUS,
            info: {
                url,
                httpStatus: res.status,
            },
        });
    }
    if (/text\/html|application\/xhtml+xml/.test(contentType) === false) {
        throw new unexpectedError_1.default({
            ...unexpectedError_1.default.EXPECTED_HTML,
            info: {
                url,
                contentType,
                contentLength,
            },
        });
    }
    // no charset in content type, peek at response body for at most 1024 bytes
    const str = buf.slice(0, 1024).toString();
    let rg;
    if (contentType) {
        rg = /charset=([^;]*)/i.exec(contentType);
    }
    // html 5
    if (!rg && str) {
        rg = /<meta.+?charset=(['"])(.+?)\1/i.exec(str);
    }
    // html 4
    if (!rg && str) {
        rg = /<meta.+?content=["'].+;\s?charset=(.+?)["']/i.exec(str);
    }
    // found charset
    if (rg) {
        const supported = [
            "CP932",
            "CP936",
            "CP949",
            "CP950",
            "GB2312",
            "GBK",
            "GB18030",
            "BIG5",
            "SHIFT_JIS",
            "EUC-JP",
        ];
        const charset = rg.pop().toUpperCase();
        if (supported.includes(charset)) {
            return (0, iconv_lite_1.decode)(buf, charset).toString();
        }
    }
    return buf.toString();
}
function getRemoteMetadata(url, { fetch = node_fetch_1.default }) {
    return async function ({ oembed, metadata }) {
        if (!oembed) {
            return metadata;
        }
        const target = new URL((0, he_1.decode)(oembed.href), url);
        let res = await fetch(target.href);
        let contentType = res.headers.get("Content-Type");
        const status = res.status;
        if (status === 403 && target.protocol === "http:") {
            // try again using HTTPS
            target.protocol = "https:";
            res = await fetch(target.href);
            contentType = res.headers.get("Content-Type");
        }
        let ret;
        if (oembed.type === "application/json+oembed" &&
            /application\/json/.test(contentType)) {
            ret = await res.json();
        }
        else if (oembed.type === "text/xml+oembed" &&
            /(text|application)\/xml/.test(contentType)) {
            const data = (await res.text())
                .replace(/&gt;/g, ">")
                .replace(/&lt;/g, "<");
            const content = {};
            const parserContext = { text: "" };
            ret = await new Promise((resolve) => {
                const parser = new htmlparser2_1.Parser({
                    oncdataend: () => {
                        if (!content.html &&
                            parserContext.text.trim().startsWith("<") &&
                            parserContext.text.trim().endsWith(">")) {
                            content.html = parserContext.text.trim();
                        }
                    },
                    // eslint-disable-next-line
                    onopentag: function (name, attribs) {
                        if (parserContext.isHtml) {
                            if (!content.html) {
                                content.html = "";
                            }
                            content.html += `<${name} `;
                            content.html += Object.keys(attribs)
                                .reduce((str, k) => str +
                                (attribs[k] ? `${k}="${attribs[k]}"` : `${k}`) +
                                " ", "")
                                .trim();
                            content.html += ">";
                        }
                        if (name === "html") {
                            parserContext.isHtml = true;
                        }
                        parserContext.tagName = name;
                    },
                    ontext: function (text) {
                        parserContext.text += text;
                    },
                    onclosetag: function (tagname) {
                        if (tagname === "oembed") {
                            return;
                        }
                        if (tagname === "html") {
                            parserContext.isHtml = false;
                            return;
                        }
                        if (parserContext.isHtml) {
                            content.html += parserContext.text.trim();
                            content.html += `</${tagname}>`;
                        }
                        content[tagname] = parserContext.text.trim();
                        parserContext.tagName = "";
                        parserContext.text = "";
                    },
                    onend: function () {
                        resolve(content);
                    },
                }, {
                    recognizeCDATA: true,
                });
                parser.write(data);
                parser.end();
            });
        }
        if (!ret) {
            return metadata;
        }
        const oEmbedMetadata = Object.keys(ret)
            .map((k) => ["oEmbed:" + k, ret[k]])
            .filter(([k]) => schema_1.keys.includes(String(k)));
        metadata.push(...oEmbedMetadata);
        return metadata;
    };
}
function getMetadata(url, opts) {
    return function (text) {
        const metadata = [];
        const parserContext = { text: "" };
        let oembed;
        let distanceFromRoot = 0;
        return new Promise((resolve) => {
            const parser = new htmlparser2_1.Parser({
                onend: function () {
                    if (parserContext.favicon === undefined) {
                        metadata.push(["favicon", new URL("/favicon.ico", url).href]);
                    }
                    else {
                        metadata.push([
                            "favicon",
                            new URL(parserContext.favicon, url).href,
                        ]);
                    }
                    if (parserContext.canonical_url) {
                        metadata.push([
                            "canonical_url",
                            new URL(parserContext.canonical_url, url).href,
                        ]);
                    }
                    resolve({ oembed, metadata });
                },
                onopentagname: function (tag) {
                    parserContext.tagName = tag;
                },
                ontext: function (text) {
                    if (parserContext.tagName === "title") {
                        // makes sure we haven't already seen the title
                        if (parserContext.title !== null) {
                            if (parserContext.title === undefined) {
                                parserContext.title = "";
                            }
                            parserContext.title += text;
                        }
                    }
                },
                onopentag: function (tagname, attribs) {
                    distanceFromRoot++;
                    if (opts.oembed && attribs.href) {
                        // handle XML and JSON with a preference towards JSON since its more efficient for us
                        if (tagname === "link" &&
                            (attribs.type === "text/xml+oembed" ||
                                attribs.type === "application/json+oembed")) {
                            if (!oembed || oembed.type === "text/xml+oembed") {
                                // prefer json
                                oembed = attribs;
                            }
                        }
                    }
                    if (tagname === "link" &&
                        attribs.href &&
                        (attribs.rel === "icon" || attribs.rel === "shortcut icon")) {
                        parserContext.favicon = attribs.href;
                    }
                    if (tagname === "link" &&
                        attribs.href &&
                        attribs.rel === "canonical") {
                        parserContext.canonical_url = attribs.href;
                    }
                    let pair;
                    if (tagname === "meta") {
                        if (attribs.name === "description" && attribs.content) {
                            pair = ["description", attribs.content];
                        }
                        else if (attribs.name === "author" && attribs.content) {
                            pair = ["author", attribs.content];
                        }
                        else if (attribs.name === "theme-color" && attribs.content) {
                            pair = ["theme_color", attribs.content];
                        }
                        else if (attribs.name === "keywords" && attribs.content) {
                            const keywords = attribs.content
                                .replace(/^[,\s]{1,}|[,\s]{1,}$/g, "") // gets rid of trailing space or sommas
                                .split(/,{1,}\s{0,}/); // splits on 1+ commas followed by 0+ spaces
                            pair = ["keywords", keywords];
                        }
                        else if (attribs.property && schema_1.keys.includes(attribs.property)) {
                            const content = attribs.content || attribs.value;
                            pair = [attribs.property, content];
                        }
                        else if (attribs.name && schema_1.keys.includes(attribs.name)) {
                            const content = attribs.content || attribs.value;
                            pair = [attribs.name, content];
                        }
                    }
                    if (pair) {
                        metadata.push(pair);
                    }
                },
                onclosetag: function (tag) {
                    distanceFromRoot--;
                    parserContext.tagName = "";
                    if (distanceFromRoot <= 2 && tag === "title") {
                        metadata.push(["title", parserContext.title]);
                        parserContext.title = "";
                    }
                    // We want to parse as little as possible so finish once we see </head>
                    // if we have not seen a title tag within the head, we scan the entire
                    // document instead
                    if (tag === "head" && parserContext.title) {
                        parser.reset();
                    }
                },
            });
            parser.write(text);
            parser.end();
        });
    };
}
function parse(url) {
    return function (metadata) {
        // eslint-disable-next-line
        const parsed = {};
        const ogVideoTags = [];
        const articleTags = [];
        let lastParent;
        for (const meta of metadata) {
            const metaKey = meta[0];
            let metaValue = meta[1];
            const item = schema_1.schema.get(metaKey);
            // decoding html entities
            if (typeof metaValue === "string") {
                metaValue = (0, he_1.decode)((0, he_1.decode)(metaValue.toString()));
            }
            else if (Array.isArray(metaValue)) {
                metaValue = metaValue.map((val) => (0, he_1.decode)((0, he_1.decode)(val)));
            }
            if (!item) {
                parsed[metaKey] = metaValue;
                continue;
            }
            // special case for video tags which we want to map to each video object
            if (metaKey === "og:video:tag") {
                ogVideoTags.push(metaValue);
                continue;
            }
            if (metaKey === "article:tag") {
                articleTags.push(metaValue);
                continue;
            }
            if (item.type === "number") {
                metaValue = parseInt(metaValue, 10);
            }
            else if (item.type === "url" && metaValue) {
                metaValue = new URL(metaValue, url).href;
            }
            if (parsed[item.entry] === undefined) {
                parsed[item.entry] = {};
            }
            let target = parsed[item.entry];
            if (item.parent) {
                if (item.category) {
                    if (!target[item.parent]) {
                        target[item.parent] = {};
                    }
                    if (!target[item.parent][item.category]) {
                        target[item.parent][item.category] = {};
                    }
                    target = target[item.parent][item.category];
                }
                else {
                    if (Array.isArray(target[item.parent]) === false) {
                        target[item.parent] = [];
                    }
                    if (!target[item.parent][target[item.parent].length - 1]) {
                        target[item.parent].push({});
                    }
                    else if ((!lastParent || item.parent === lastParent) &&
                        target[item.parent][target[item.parent].length - 1] &&
                        target[item.parent][target[item.parent].length - 1][item.name]) {
                        target[item.parent].push({});
                    }
                    lastParent = item.parent;
                    target = target[item.parent][target[item.parent].length - 1];
                }
            }
            // some fields map to the same name so once we have one stick with it
            target[item.name] || (target[item.name] = metaValue);
        }
        if (ogVideoTags.length && parsed.open_graph.videos) {
            parsed.open_graph.videos = parsed.open_graph.videos.map((obj) => ({
                ...obj,
                tags: ogVideoTags,
            }));
        }
        if (articleTags.length && parsed.open_graph.articles) {
            parsed.open_graph.articles = parsed.open_graph.articles.map((obj) => ({
                ...obj,
                tags: articleTags,
            }));
        }
        return parsed;
    };
}
//# sourceMappingURL=index.js.map