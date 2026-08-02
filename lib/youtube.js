const axios = require('axios');
const cheerio = require('cheerio');

function parseDuration(duration) {
   if (!duration || typeof duration !== 'string') return null;
   let normalized = duration;
   if (!duration.includes(':') && duration.includes('.')) {
      const dotParts = duration.split('.');
      if (dotParts.length >= 2 && dotParts.length <= 3 && dotParts.every(p => /^\d{1,2}$/.test(p))) {
         normalized = dotParts.join(':');
      }
   }
   const parts = normalized.split(':').map(Number);
   if (parts.some(isNaN)) return null;
   let seconds = 0;
   for (let i = 0; i < parts.length; i++) {
      seconds += parts[i] * Math.pow(60, parts.length - 1 - i);
   }
   return seconds;
}


function formatDurationID(seconds) {
   if (seconds == null) return null;
   const h = Math.floor(seconds / 3600);
   const m = Math.floor((seconds % 3600) / 60);
   const s = Math.floor(seconds % 60);
   const parts = [];
   if (h > 0) parts.push(`${h} hours`);
   if (m > 0) parts.push(`${m} minutes`);
   if (s > 0 || parts.length === 0) parts.push(`${s} seconds`);
   return parts.join(' ');
}


function parseViewCount(viewStr) {
   if (!viewStr || typeof viewStr !== 'string') return null;

   const lower = viewStr.toLowerCase();

   const multipliers = [
      ['billion',  1e9], ['milyar', 1e9], ['miliar', 1e9],
      ['million',  1e6], ['thousand', 1e3],
      ['juta',     1e6], ['ribu',     1e3],
      ['rbu',      1e3], ['jt',       1e6], ['rb', 1e3],
      ['b',        1e9], ['m',        1e6], ['k',  1e3],
   ];

   function isWordBoundary(str, idx, suffixLen) {
      const before = idx > 0 ? str[idx - 1] : ' ';
      const after  = str[idx + suffixLen];
      return !/[a-z]/.test(before) && !/[a-z]/.test(after);
   }

   for (const [suffix, mult] of multipliers) {
      let searchFrom = 0;
      while (true) {
         const idx = lower.indexOf(suffix, searchFrom);
         if (idx === -1) break;
         if (isWordBoundary(lower, idx, suffix.length)) {
            const numPart = viewStr.substring(0, idx).trim();
            const cleaned = numPart.replace(/[^0-9.,]/g, '');
            if (cleaned) {
               const parsed = parseNumberString(cleaned);
               if (parsed !== null) return Math.round(parsed * mult);
            }
         }
         searchFrom = idx + 1;
      }
   }

   const cleaned = viewStr.replace(/[^0-9.,]/g, '');
   if (!cleaned) return null;
   const numStr = cleaned.replace(/[.,]/g, '');
   const num = parseInt(numStr, 10);
   return isNaN(num) ? null : num;
}


function parseNumberString(cleaned) {
   const dotCount   = (cleaned.match(/\./g) || []).length;
   const commaCount = (cleaned.match(/,/g) || []).length;

   let numStr = cleaned;

   if (dotCount >= 2 && commaCount === 0) {
      numStr = cleaned.replace(/\./g, '');
   } else if (commaCount >= 2 && dotCount === 0) {
      numStr = cleaned.replace(/,/g, '');
   } else if (dotCount === 1 && commaCount === 0) {
      const afterDot = cleaned.split('.')[1] || '';
      if (afterDot.length === 3) {
         numStr = cleaned.replace(/\./g, '');
      } else {
         numStr = cleaned;
      }
   } else if (commaCount === 1 && dotCount === 0) {
      const afterComma = cleaned.split(',')[1] || '';
      if (afterComma.length === 3) {
         numStr = cleaned.replace(/,/g, '');
      } else {
         numStr = cleaned.replace(',', '.');
      }
   } else if (dotCount === 1 && commaCount === 1) {
      if (cleaned.indexOf(',') < cleaned.indexOf('.')) {
         numStr = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
         numStr = cleaned.replace(/,/g, '');
      }
   } else {
      numStr = cleaned.replace(/[.,]/g, '');
   }

   const num = parseFloat(numStr);
   return isNaN(num) ? null : num;
}

function extractRunsText(runs, filterEmpty = false) {
   if (!Array.isArray(runs)) return null;
   const filtered = filterEmpty ? runs.filter(r => r.text) : runs;
   return filtered.map(r => r.text).join('') || null;
}


function get(obj, ...path) {
   let current = obj;
   for (const key of path) {
      if (current == null) return undefined;
      current = current[key];
   }
   return current;
}


function getBestThumbnail(thumbnails) {
   if (!Array.isArray(thumbnails) || thumbnails.length === 0) return null;
   const filtered = thumbnails.filter(t => t.url);
   if (filtered.length === 0) return null;
   return filtered[filtered.length - 1].url;
}

function normalizeUrl(url) {
   if (!url) return null;
   if (url.startsWith('//')) return 'https:' + url;
   if (url.startsWith('http://') || url.startsWith('https://')) return url;
   return 'https://' + url;
}


function extractYtInitialData(html) {
   const $ = cheerio.load(html);
   const scriptTags = $('script').toArray();

   for (const tag of scriptTags) {
      const content = $(tag).html();
      if (!content || !content.includes('var ytInitialData = ')) continue;

      const startIndex = content.indexOf('var ytInitialData = ') + 'var ytInitialData = '.length;
      const jsonStr = content.substring(startIndex).replace(/;$/, '').trim();
      try {
         return JSON.parse(jsonStr);
      } catch (e) {
         let depth = 0;
         let end = -1;
         for (let i = 0; i < jsonStr.length; i++) {
            if (jsonStr[i] === '{') depth++;
            else if (jsonStr[i] === '}') depth--;
            if (depth === 0) { end = i + 1; break; }
         }
         if (end > 0) {
            try {
               return JSON.parse(jsonStr.substring(0, end));
            } catch (_) {
            }
         }
      }
   }
   return null;
}


function extractBadges(badges) {
   if (!Array.isArray(badges) || badges.length === 0) return [];
   return badges
      .map(b => b.metadataBadgeRenderer)
      .filter(Boolean)
      .map(b => get(b, 'accessibilityData', 'label') || b.label || b.style || '')
      .filter(Boolean);
}


function isLiveVideo(result) {
   const overlay = (result.thumbnailOverlays || []).find(
      o => 'thumbnailOverlayTimeStatusRenderer' in o
   );
   if (!overlay) return false;
   const status = get(overlay, 'thumbnailOverlayTimeStatusRenderer', 'style');
   return status === 'LIVE';
}


function isUpcomingVideo(result) {
   const overlay = (result.thumbnailOverlays || []).find(
      o => 'thumbnailOverlayTimeStatusRenderer' in o
   );
   if (!overlay) return false;
   const status = get(overlay, 'thumbnailOverlayTimeStatusRenderer', 'style');
   return status === 'UPCOMING';
}


function parseVideo(result) {
   const videoId = result.videoId;
   if (!videoId) return null;

   const live = isLiveVideo(result);
   const upcoming = isUpcomingVideo(result);

   const lengthText = get(result, 'lengthText', 'simpleText');
   const overlayDuration = (() => {
      const overlay = (result.thumbnailOverlays || []).find(
         o => 'thumbnailOverlayTimeStatusRenderer' in o
      );
      return get(overlay, 'thumbnailOverlayTimeStatusRenderer', 'text', 'simpleText');
   })();
   const durationStr = lengthText || overlayDuration || null;
   const durationS = parseDuration(durationStr);
   const durationH = (() => {
      const overlay = (result.thumbnailOverlays || []).find(
         o => 'thumbnailOverlayTimeStatusRenderer' in o
      );
      return get(overlay, 'thumbnailOverlayTimeStatusRenderer', 'text', 'accessibilityData', 'accessibilityData', 'label') ||
             get(result, 'lengthText', 'accessibilityData', 'accessibilityData', 'label') ||
             null;
   })();

   const viewSimpleText = get(result, 'viewCountText', 'simpleText');
   const viewShortText = get(result, 'shortViewCountText', 'simpleText');
   const viewAccessibilityLabel = get(result, 'shortViewCountText', 'accessibilityData', 'accessibilityData', 'label');
   const viewH = viewSimpleText || viewShortText || viewAccessibilityLabel || null;

   const titleRuns = get(result, 'title', 'runs');
   let title = null;
   if (Array.isArray(titleRuns)) {
      const found = titleRuns.find(r => r.text);
      title = found ? found.text.trim() : null;
   }
   if (!title) {
      title = get(result, 'title', 'accessibilityData', 'accessibilityData', 'label');
      if (title) title = title.trim();
   }

   const ownerRuns = get(result, 'ownerText', 'runs') || get(result, 'longBylineText', 'runs') || [];
   const authorRun = ownerRuns.find(r => r.text && r.text.trim()) || ownerRuns[0];
   const authorName = authorRun ? authorRun.text.trim() : null;
   let channelId = null;
   const navigationEndpoint = authorRun ? get(authorRun, 'navigationEndpoint') : null;
   if (navigationEndpoint) {
      channelId = get(navigationEndpoint, 'browseEndpoint', 'browseId');
   }
   if (!channelId) {
      const longRuns = get(result, 'longBylineText', 'runs') || [];
      const longRun = longRuns.find(r => r.text);
      if (longRun) {
         channelId = get(longRun, 'navigationEndpoint', 'browseEndpoint', 'browseId');
      }
   }

   const avatarThumbnails = get(result, 'channelThumbnailSupportedRenderers', 'channelThumbnailWithLinkRenderer', 'thumbnail', 'thumbnails');
   const authorAvatar = normalizeUrl(getBestThumbnail(avatarThumbnails));

   const thumbnail = getBestThumbnail(get(result, 'thumbnail', 'thumbnails'));

   const snippetRuns = get(result, 'detailedMetadataSnippets', '0', 'snippetText', 'runs');
   const description = snippetRuns ? extractRunsText(snippetRuns, true) : null;

   const publishedTime = get(result, 'publishedTimeText', 'simpleText');

   const badges = extractBadges(get(result, 'badges') || []);

   const publishedDateText = get(result, 'publishedTimeText', 'simpleText');

   return {
      type: 'video',
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title,
      thumbnail,
      description,
      author: {
         name: authorName,
         id: channelId,
         avatar: authorAvatar,
         url: channelId ? `https://www.youtube.com/channel/${channelId}` : null
      },
      publishedTime,
      duration: {
         raw: durationStr,
         seconds: durationS,
         human: live ? 'LIVE' : (upcoming ? 'UPCOMING' : formatDurationID(durationS)),
         accessibility: durationH
      },
      views: {
         raw: viewH,
         count: parseViewCount(viewH)
      },
      isLive: live,
      isUpcoming: upcoming,
      badges
   };
}


function parseChannel(result) {
   const channelId = result.channelId;
   if (!channelId) return null;

   const titleSimple = get(result, 'title', 'simpleText');
   const shortBylineRuns = get(result, 'shortBylineText', 'runs');
   let channelName = titleSimple;
   if (!channelName && Array.isArray(shortBylineRuns)) {
      const found = shortBylineRuns.find(r => r.text);
      channelName = found ? found.text.trim() : null;
   }

   const avatar = normalizeUrl(getBestThumbnail(get(result, 'thumbnail', 'thumbnails')));

   const videoCountText = get(result, 'videoCountText', 'simpleText') || '';
   const subscriberCountText = get(result, 'subscriberCountText', 'simpleText') || '';
   const subscriberCountLabel = get(result, 'subscriberCountText', 'accessibilityData', 'accessibilityData', 'label') || '';

   const candidates = [videoCountText, subscriberCountText, subscriberCountLabel].filter(Boolean);

   let subscriberH = null;
   let videoCountH = null;

   for (const c of candidates) {
      const lower = c.toLowerCase();
      if (!subscriberH && /subscriber|pelanggan/.test(lower)) {
         subscriberH = c;
      } else if (!videoCountH && /video/.test(lower)) {
         videoCountH = c;
      }
   }

   if (!subscriberH) {
      if (/^\d/.test(subscriberCountText)) subscriberH = subscriberCountText;
      else if (/^\d/.test(videoCountText)) subscriberH = videoCountText;
      else if (/^\d/.test(subscriberCountLabel)) subscriberH = subscriberCountLabel;
   }

   let handle = null;
   for (const c of candidates) {
      if (/^@\w/.test(c)) { handle = c; break; }
   }

   const ownerBadges = get(result, 'ownerBadges') || [];
   const isVerified = ownerBadges.some(b =>
      get(b, 'metadataBadgeRenderer', 'style') === 'BADGE_STYLE_TYPE_VERIFIED' ||
      get(b, 'metadataBadgeRenderer', 'tooltip') === 'Terverifikasi' ||
      get(b, 'metadataBadgeRenderer', 'tooltip') === 'Verified'
   );

   const descRuns = get(result, 'descriptionSnippet', 'runs');
   const description = descRuns ? extractRunsText(descRuns, true) : null;

   return {
      type: 'channel',
      channelId,
      url: `https://www.youtube.com/channel/${channelId}`,
      channelName,
      handle,
      avatar,
      isVerified,
      subscriber: {
         raw: subscriberH,
         count: parseViewCount(subscriberH)
      },
      videoCount: videoCountH || null,
      description
   };
}


function parseMix(result) {
   const playlistId = result.playlistId;
   if (!playlistId) return null;

   const title = get(result, 'title', 'simpleText');
   const thumbnail = getBestThumbnail(get(result, 'thumbnail', 'thumbnails'));

   const videos = (result.videos || []).map(v => {
      const child = v.childVideoRenderer;
      if (!child) return null;
      const vid = child.videoId;
      const childDurationStr = get(child, 'lengthText', 'simpleText');
      const childDurationAccessLabel = get(child, 'lengthText', 'accessibilityData', 'accessibilityData', 'label');
      return {
         videoId: vid,
         url: `https://www.youtube.com/watch?v=${vid}&list=${playlistId}`,
         title: get(child, 'title', 'simpleText'),
         duration: {
            raw: childDurationStr,
            human: formatDurationID(parseDuration(childDurationStr)),
            accessibility: childDurationAccessLabel
         }
      };
   }).filter(Boolean);

   return {
      type: 'mix',
      playlistId,
      url: `https://www.youtube.com/watch?v=${videos[0]?.videoId || ''}&list=${playlistId}`,
      title,
      thumbnail,
      videoCount: videos.length,
      videos
   };
}

/**
 * Main: Search YouTube and return structured results.
 *
 * @param {string} query - Search query
 * @param {object} [options] - Optional settings
 * @param {string} [options.type] - Filter type: 'all', 'video', 'channel', 'playlist'
 * @param {number} [options.limit] - Max results per category (default: no limit)
 * @returns {Promise<{video: object[], channel: object[], playlist: object[], query: string}>}
 */
function YoutubeSearch(query, options = {}) {
   return new Promise(async (resolve, reject) => {
      if (!query || typeof query !== 'string') {
         return reject(new Error('Query must be a non-empty string.'));
      }

      const { type = 'all', limit } = options;
      const encodedQuery = encodeURIComponent(query);

      try {
         const { data } = await axios.get(`https://m.youtube.com/results?search_query=${encodedQuery}`, {
            method: 'GET',
            headers: {
               'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
               'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
               'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            timeout: 15000
         });

         const ytData = extractYtInitialData(data);
         if (!ytData) {
            return reject(new Error('Failed to extract ytInitialData from page. YouTube might have changed its structure or IP is blocked.'));
         }

         const contents = get(ytData, 'contents', 'twoColumnSearchResultsRenderer', 'primaryContents', 'sectionListRenderer', 'contents');
         if (!Array.isArray(contents) || contents.length === 0) {
            return reject(new Error('No search results found. Page structure might have changed.'));
         }

         const results = { video: [], channel: [], playlist: [] };

         for (const section of contents) {
            const sectionContents = get(section, 'itemSectionRenderer', 'contents');
            if (!Array.isArray(sectionContents)) continue;

            for (const item of sectionContents) {
               const typeName = Object.keys(item)[0];
               if (!typeName) continue;

               if (['horizontalCardListRenderer', 'shelfRenderer', 'promotedVideoRenderer', 'adSlotRenderer'].includes(typeName)) {
                  continue;
               }

               const parsed = item[typeName];
               if (!parsed) continue;

               try {
                  if (typeName === 'videoRenderer') {
                     if (type !== 'all' && type !== 'video') continue;
                     const video = parseVideo(parsed);
                     if (video) {
                        results.video.push(video);
                        if (limit && results.video.length >= limit) break;
                     }
                  } else if (typeName === 'channelRenderer') {
                     if (type !== 'all' && type !== 'channel') continue;
                     const channel = parseChannel(parsed);
                     if (channel) {
                        results.channel.push(channel);
                        if (limit && results.channel.length >= limit) break;
                     }
                  } else if (typeName === 'radioRenderer') {
                     if (type !== 'all' && type !== 'playlist') continue;
                     const mix = parseMix(parsed);
                     if (mix) {
                        results.playlist.push(mix);
                        if (limit && results.playlist.length >= limit) break;
                     }
                  }
               } catch (parseErr) {
                  console.warn(`[YouTubeSearch] Failed to parse ${typeName}: ${parseErr.message}`);
               }
            }

            const allLimited = (['video', 'channel', 'playlist'].every(cat => {
               if (type !== 'all' && type !== cat) return true; 
               return limit && results[cat].length >= limit;
            }));
            if (allLimited) break;
         }

         resolve({
            query,
            ...results
         });

      } catch (error) {
         if (error.response) {
            const status = error.response.status;
            if (status === 429) {
               reject(new Error('Too many requests (429). Please try again later.'));
            } else if (status === 403) {
               reject(new Error('Access denied (403). YouTube might be blocking this request.'));
            } else {
               reject(new Error(`HTTP Error ${status}: ${error.response.statusText}`));
            }
         } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            reject(new Error('Request timeout. Please check your internet connection.'));
         } else if (error.code === 'ENOTFOUND') {
            reject(new Error('Unable to connect to YouTube. Please check your internet connection.'));
         } else {
            reject(error);
         }
      }
   });
}

/**
 * Fetch a specific YouTube user's data without using an API key.
 * Scrapes from their /playlists page.
 * 
 * @param {string} username - The YouTube handle (e.g. "@eleremen")
 * @returns {Promise<object>}
 */
function YoutubeUser(username) {
   return new Promise(async (resolve, reject) => {
      if (!username || typeof username !== 'string') {
         return reject(new Error('Username must be a non-empty string.'));
      }

      let formattedUsername = username.trim();
      if (!formattedUsername.startsWith('@') && !formattedUsername.startsWith('UC')) {
         formattedUsername = '@' + formattedUsername;
      }

      try {
         const { data } = await axios.get(`https://www.youtube.com/${formattedUsername}/playlists`, {
            method: 'GET',
            headers: {
               'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
               'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
               'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            timeout: 15000
         });

         const ytData = extractYtInitialData(data);
         if (!ytData) {
            return reject(new Error('Failed to extract ytInitialData from page. YouTube might have changed its structure or user not found.'));
         }

         let name = null;
         let avatar = null;
         let subscribers = null;
         let totalVideos = null;
         let totalPlaylists = 0;

         const header = get(ytData, 'header', 'pageHeaderRenderer');
         if (header) {
             const title = get(header, 'pageTitle');
             const content = get(header, 'content', 'pageHeaderViewModel');
             const avatarUrl = get(content, 'image', 'decoratedAvatarViewModel', 'avatar', 'avatarViewModel', 'image', 'sources', 0, 'url');
             const titleText = get(content, 'title', 'dynamicTextViewModel', 'text', 'content');
             
             name = titleText || title;
             avatar = avatarUrl ? normalizeUrl(avatarUrl) : null;

             const metadataParts = get(content, 'metadata', 'contentMetadataViewModel', 'metadataRows', 1, 'metadataParts');
             if (metadataParts && Array.isArray(metadataParts)) {
                 metadataParts.forEach(part => {
                     const text = get(part, 'text', 'content');
                     if (text) {
                         const lower = text.toLowerCase();
                         if (lower.includes('subscriber') || lower.includes('pelanggan')) {
                             subscribers = text;
                         } else if (lower.includes('video')) {
                             totalVideos = text;
                         }
                     }
                 });
             }
         } else {
             const c4Header = get(ytData, 'header', 'c4TabbedHeaderRenderer');
             if (c4Header) {
                 name = get(c4Header, 'title');
                 avatar = normalizeUrl(getBestThumbnail(get(c4Header, 'avatar', 'thumbnails')));
                 subscribers = get(c4Header, 'subscriberCountText', 'simpleText');
             }
         }

         const tabs = get(ytData, 'contents', 'twoColumnBrowseResultsRenderer', 'tabs');
         const playlists = [];
         if (tabs) {
             const playlistTab = tabs.find(t => get(t, 'tabRenderer', 'title') === 'Playlists' || get(t, 'tabRenderer', 'title') === 'Playlist' || get(t, 'tabRenderer', 'selected') === true);
             if (playlistTab) {
                 const contents = get(playlistTab, 'tabRenderer', 'content', 'sectionListRenderer', 'contents');
                 if (Array.isArray(contents)) {
                     contents.forEach(section => {
                         const items = get(section, 'itemSectionRenderer', 'contents', 0, 'gridRenderer', 'items');
                         if (Array.isArray(items)) {
                              items.forEach(item => {
                                  const lockup = get(item, 'lockupViewModel');
                                  if (lockup) {
                                      const playlistId = get(lockup, 'contentId');
                                      const title = get(lockup, 'metadata', 'lockupMetadataViewModel', 'title', 'content');
                                      const thumbnail = get(lockup, 'image', 'contentImageViewModel', 'image', 'sources', 0, 'url');
                                      
                                      let videoCount = null;
                                      const overlays = get(lockup, 'image', 'contentImageViewModel', 'image', 'overlays');
                                      if (Array.isArray(overlays)) {
                                          for (const overlay of overlays) {
                                              const badgeText = get(overlay, 'thumbnailOverlayBadgeViewModel', 'thumbnailBadges', 0, 'thumbnailBadgeViewModel', 'text');
                                              if (badgeText && (badgeText.includes('video') || badgeText.match(/^\d+$/))) {
                                                  videoCount = badgeText;
                                                  break;
                                              }
                                          }
                                      }
                                      
                                      if (playlistId) {
                                          playlists.push({
                                              playlistId,
                                              title,
                                              thumbnail: normalizeUrl(thumbnail),
                                              videoCount,
                                              url: `https://www.youtube.com/playlist?list=${playlistId}`
                                          });
                                      }
                                  } else {
                                      const gridPlaylist = get(item, 'gridPlaylistRenderer') || get(item, 'gridShowRenderer');
                                      if (gridPlaylist) {
                                          const playlistId = get(gridPlaylist, 'playlistId');
                                          const title = get(gridPlaylist, 'title', 'runs', 0, 'text') || get(gridPlaylist, 'title', 'simpleText');
                                          const thumbnail = get(gridPlaylist, 'thumbnail', 'thumbnails', 0, 'url');
                                          const videoCount = get(gridPlaylist, 'videoCountText', 'runs', 0, 'text') || get(gridPlaylist, 'videoCountShortText', 'simpleText');
                                          
                                          if (playlistId) {
                                              playlists.push({
                                                  playlistId,
                                                  title,
                                                  thumbnail: normalizeUrl(thumbnail),
                                                  videoCount,
                                                  url: `https://www.youtube.com/playlist?list=${playlistId}`
                                              });
                                          }
                                      }
                                  }
                              });
                         }
                     });
                 }
             }
         }
         
         totalPlaylists = playlists.length;

         resolve({
            username: formattedUsername,
            name,
            avatar,
            subscribers,
            totalVideos,
            totalPlaylists,
            url: `https://www.youtube.com/${formattedUsername}`,
            playlists
         });

      } catch (error) {
         if (error.response && error.response.status === 404) {
            return reject(new Error('User not found (404).'));
         }
         reject(error);
      }
   });
}

/**
 * Fetch a specific YouTube playlist's details and videos without using an API key.
 * 
 * @param {string} playlistId - The YouTube playlist ID (e.g. "PLYH8WvNV1YEnOwmzyWz4vR0HsX1Qn0PoU")
 * @returns {Promise<object>}
 */
function YoutubePlaylist(playlistId) {
   return new Promise(async (resolve, reject) => {
      if (!playlistId || typeof playlistId !== 'string') {
         return reject(new Error('Playlist ID must be a non-empty string.'));
      }

      try {
         const { data } = await axios.get(`https://www.youtube.com/playlist?list=${playlistId}`, {
            method: 'GET',
            headers: {
               'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
               'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
               'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            timeout: 15000
         });

         const ytData = extractYtInitialData(data);
         if (!ytData) {
            return reject(new Error('Failed to extract ytInitialData from page. YouTube might have changed its structure or playlist is not found/private.'));
         }

         let title = null;
         let author = null;
         let totalVideosText = null;

         if (ytData.header && ytData.header.playlistHeaderRenderer) {
             const header = ytData.header.playlistHeaderRenderer;
             title = get(header, 'title', 'runs', 0, 'text') || get(header, 'title', 'simpleText');
             const ownerText = get(header, 'ownerText', 'runs', 0, 'text');
             if (ownerText) author = ownerText;
             
             const stats = get(header, 'numVideosText', 'runs', 0, 'text');
             if (stats) totalVideosText = stats;
         } else if (ytData.header && ytData.header.pageHeaderRenderer) {
             const titleText = get(ytData.header.pageHeaderRenderer, 'pageTitle');
             if (titleText) title = titleText;
         }

         const videos = [];
         
         const contents = get(ytData, 'contents', 'twoColumnBrowseResultsRenderer', 'tabs', 0, 'tabRenderer', 'content', 'sectionListRenderer', 'contents', 0, 'itemSectionRenderer', 'contents', 0, 'playlistVideoListRenderer', 'contents');
         
         if (contents && Array.isArray(contents)) {
             for (const item of contents) {
                 const video = get(item, 'playlistVideoRenderer');
                 if (video) {
                     const videoId = get(video, 'videoId');
                     const videoTitle = get(video, 'title', 'runs', 0, 'text');
                     const duration = get(video, 'lengthText', 'simpleText');
                     const thumbnail = get(video, 'thumbnail', 'thumbnails', 0, 'url');
                     const channel = get(video, 'shortBylineText', 'runs', 0, 'text');
                     const channelId = get(video, 'shortBylineText', 'runs', 0, 'navigationEndpoint', 'browseEndpoint', 'browseId');
                     
                     if (videoId && videoTitle) {
                         videos.push({
                             videoId,
                             title: videoTitle,
                             duration,
                             thumbnail: normalizeUrl(thumbnail),
                             channel,
                             channelId,
                             url: `https://www.youtube.com/watch?v=${videoId}`
                         });
                     }
                 }
             }
         } else {
             const fallbackContents = get(ytData, 'contents', 'twoColumnBrowseResultsRenderer', 'tabs', 0, 'tabRenderer', 'content', 'sectionListRenderer', 'contents', 0, 'itemSectionRenderer', 'contents');
             
             if (fallbackContents && Array.isArray(fallbackContents)) {
                 for (const item of fallbackContents) {
                     const lockup = get(item, 'lockupViewModel');
                     if (lockup) {
                         const videoId = get(lockup, 'contentId');
                         const videoTitle = get(lockup, 'metadata', 'lockupMetadataViewModel', 'title', 'content');
                         const thumbnail = get(lockup, 'image', 'contentImageViewModel', 'image', 'sources', 0, 'url');
                         
                         let channel = null;
                         let duration = null;
                         
                         const metadataParts = get(lockup, 'metadata', 'lockupMetadataViewModel', 'metadata', 'contentMetadataViewModel', 'metadataRows', 0, 'metadataParts');
                         if (Array.isArray(metadataParts)) {
                             channel = get(metadataParts, 0, 'text', 'content');
                         }
                         
                         const overlays = get(lockup, 'image', 'contentImageViewModel', 'image', 'overlays');
                         if (Array.isArray(overlays)) {
                             for (const overlay of overlays) {
                                 const badgeText = get(overlay, 'thumbnailOverlayBadgeViewModel', 'thumbnailBadges', 0, 'thumbnailBadgeViewModel', 'text');
                                 if (badgeText && badgeText.includes(':')) {
                                     duration = badgeText;
                                     break;
                                 }
                             }
                         }
                         
                         if (videoId && videoTitle) {
                             videos.push({
                                 videoId,
                                 title: videoTitle,
                                 duration,
                                 thumbnail: normalizeUrl(thumbnail),
                                 channel,
                                 url: `https://www.youtube.com/watch?v=${videoId}`
                             });
                         }
                     }
                 }
             }
         }

         resolve({
            playlistId,
            title,
            author,
            totalVideosText,
            url: `https://www.youtube.com/playlist?list=${playlistId}`,
            videos
         });

      } catch (error) {
         if (error.response && error.response.status === 404) {
            return reject(new Error('Playlist not found (404) or set to private.'));
         }
         reject(error);
      }
   });
}

module.exports = { YoutubeSearch, YoutubeUser, YoutubePlaylist };
