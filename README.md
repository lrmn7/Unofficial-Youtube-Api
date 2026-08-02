<div align="center">
  <h1>Unofficial YouTube API</h1>
  <p>A simple, unofficial, and completely free API to scrape and fetch YouTube data no API keys required.</p>
</div>

---

## 🚀 Features

- **No API Key Required**: Fully built on web scraping (ytInitialData) to bypass official YouTube API limits.
- **Search Capabilities**: Find videos, channels, and playlists dynamically.
- **User Profiles**: Fetch detailed channel metadata, subscriber counts, and public playlists effortlessly.
- **Playlist Extractor**: Retrieve all tracks and videos embedded within a specific playlist.
- **Fast & Lightweight**: Built on top of Express, Axios, and Cheerio.

---

## 📡 Endpoints

The API currently supports the following GET endpoints:

| Endpoint              | Parameter | Description                                               |
|-----------------------|-----------|-----------------------------------------------------------|
| `/youtube/search`     | `all`       | Search for videos, channels, and playlists (mixed).       |
| `/youtube/search`     | `channel`   | Search for channels only.                                 |
| `/youtube/search`     | `playlist`  | Search for playlists only.                                |
| `/youtube/search`     | `video`     | Search for videos only.                                   |
| `/youtube/user`       | `username`  | Fetch user profile and their list of public playlists.    |
| `/youtube/playlist`   | `id`        | Fetch a detailed list of all videos/tracks in a playlist. |

> **Note on Parameter Priority:**
> When querying the `/youtube/search` endpoint, parameters are evaluated in the following priority: `channel` > `video` > `playlist` > `all`. Ensure you use only one search type per request.

---

## 🛠️ Usage Examples

### 1. Searching
Avoid mixing query parameters like `?all=keyword&channel=keyword`. Only the parameter with the highest priority will be processed.

**Correct Usage:**
- `GET /youtube/search?channel=PewDiePie`
- `GET /youtube/search?video=Music+Video`
- `GET /youtube/search?playlist=LoFi+HipHop`
- `GET /youtube/search?all=MrBeast`

### 2. Fetching User Data
Use the channel handle (starts with `@`) to fetch their profile details, subscriber counts, avatar, and a list of their public playlists.

- `GET /youtube/user?username=@PewDiePie`

### 3. Fetching Playlist Content
Extract all the videos inside a specific playlist using the unique Playlist ID.

- `GET /youtube/playlist?id=PLYH8WvNV1YEnOwmzyWz4vR0HsX1Qn0PoU`

---

## 🤝 Contributing

Contributions, issues, and feature requests are always welcome! Feel free to check the [issues page](https://github.com/lrmn7/Unofficial-Youtube-Api/issues). If you'd like to contribute, just fork the repository and submit a **Pull Request**.

---
