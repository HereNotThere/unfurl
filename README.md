# HNT

Modified to work in a Cloudflare Worker environment.

Includes `dist` so this package should be included via github:

```
yarn add unfurl.js@<git-remote-url>

```

## Development

- clone, `npm i`
- Make a new branch (can't commit to master directly), make changes, commit
- Pre-commit hook runs tests and will build `dist`
- Push, PR

# Unfurl

A metadata scraper with support for oEmbed, Twitter Cards and Open Graph Protocol for Node.js (>=v8.0.0).

Note: Will not work in the Browser

[![Travis CI](https://img.shields.io/travis/jacktuck/unfurl?style=flat-square)](https://travis-ci.org/jacktuck/unfurl)
[![Coverage Status](https://img.shields.io/coveralls/jacktuck/unfurl?style=flat-square)](https://coveralls.io/github/jacktuck/unfurl?branch=master)
[![Known Vulnerabilities](https://snyk.io/test/github/jacktuck/unfurl/badge.svg?style=flat-square)](https://snyk.io/test/github/jacktuck/unfurl)
[![npm](https://img.shields.io/npm/v/unfurl.js?style=flat-square)](https://www.npmjs.com/package/unfurl.js)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/jacktuck)

## The what

Unfurl _(spread out from a furled state)_ will take a `url` and some `options`, fetch the `url`, extract the metadata we care about and format the result in a sane way. It supports all major metadata providers and expanding it to work for any others should be trivial.

## The why

So you know when you link to something on Slack, or Facebook, or Twitter - they typically show a preview of the link. To do so they have crawled the linked website for metadata and enriched the link by providing more context about it. Which usually entails grabbing its title, description and image/player embed.

## The how

```bash
npm install unfurl.js
```

### `unfurl(url [, opts])`

#### url - `string`

---

#### opts - `object` of:

- `oembed?: boolean` - support retrieving oembed metadata
- `timeout? number` - req/res timeout in ms, it resets on redirect. 0 to disable (OS limit applies)
- `follow?: number` - maximum redirect count. 0 to not follow redirect
- `compress?: boolean` - support gzip/deflate content encoding
- `size?: number` - maximum response body size in bytes. 0 to disable
- `headers?: Headers | Record<string, string> | Iterable<readonly [string, string]> | Iterable<Iterable<string>>` - map of request headers, overrides the defaults

Default headers:

```
{
  'Accept': 'text/html, application/xhtml+xml',
  'User-Agent': 'facebookexternalhit'
}
```

---

#

```typescript
import { unfurl } from "unfurl.js";
const result = unfurl("https://github.com/trending");
```

---

#### result is `<Promise<Metadata>>`

```typescript
type Metadata = {
  title?: string;
  description?: string;
  keywords?: string[];
  favicon?: string;
  author?: string;
  theme_color?: string;
  canonical_url?: string;
  oEmbed?: OEmbedPhoto | OEmbedVideo | OEmbedLink | OEmbedRich;
  twitter_card: {
    card: string;
    site?: string;
    creator?: string;
    creator_id?: string;
    title?: string;
    description?: string;
    players?: {
      url: string;
      stream?: string;
      height?: number;
      width?: number;
    }[];
    apps: {
      iphone: {
        id: string;
        name: string;
        url: string;
      };
      ipad: {
        id: string;
        name: string;
        url: string;
      };
      googleplay: {
        id: string;
        name: string;
        url: string;
      };
    };
    images: {
      url: string;
      alt: string;
    }[];
  };
  open_graph: {
    title: string;
    type: string;
    images?: {
      url: string;
      secure_url?: string;
      type: string;
      width: number;
      height: number;
      alt?: string;
    }[];
    url?: string;
    audio?: {
      url: string;
      secure_url?: string;
      type: string;
    }[];
    description?: string;
    determiner?: string;
    site_name?: string;
    locale: string;
    locale_alt: string;
    videos: {
      url: string;
      stream?: string;
      height?: number;
      width?: number;
      tags?: string[];
    }[];
    article: {
      published_time?: string;
      modified_time?: string;
      expiration_time?: string;
      author?: string;
      section?: string;
      tags?: string[];
    };
  };
};

type OEmbedBase = {
  type: "photo" | "video" | "link" | "rich";
  version: string;
  title?: string;
  author_name?: string;
  author_url?: string;
  provider_name?: string;
  provider_url?: string;
  cache_age?: number;
  thumbnails?: [
    {
      url?: string;
      width?: number;
      height?: number;
    }
  ];
};

type OEmbedPhoto = OEmbedBase & {
  type: "photo";
  url: string;
  width: number;
  height: number;
};

type OEmbedVideo = OEmbedBase & {
  type: "video";
  html: string;
  width: number;
  height: number;
};

type OEmbedLink = OEmbedBase & {
  type: "link";
};

type OEmbedRich = OEmbedBase & {
  type: "rich";
  html: string;
  width: number;
  height: number;
};
```

## The who 💖

_(If you use unfurl.js too feel free to [add your project](https://github.com/jacktuck/unfurl/edit/master/README.md))_

- [vapid/vapid](https://github.com/vapid/vapid) - A template-driven content management system
- [beeman/micro-unfurl](https://github.com/beeman/micro-unfurl) - small microservice that unfurls a URL and returns the OpenGraph meta data.
- [probot/unfurl](https://github.com/probot/unfurl) - a GitHub App built with probot that unfurls links on Issues and Pull Request discussions
