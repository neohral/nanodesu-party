require("dotenv").config()
const axios = require("axios")
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

function extractVideoId(url) {
  const reg = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/
  const match = url.match(reg)
  return match ? match[1] : null
}

function extractPlaylistId(url) {
  const reg = /[?&]list=([a-zA-Z0-9_-]+)/
  const match = url.match(reg)
  return match ? match[1] : null
}

async function fetchVideoInfo(videoId) {
  const url = "https://www.googleapis.com/youtube/v3/videos"
  const res = await axios.get(url, {
    params: {
      part: "snippet",
      id: videoId,
      key: YOUTUBE_API_KEY
    }
  })

  const item = res.data.items[0]
  if (!item) return null

  return {
    videoId,
    title: item.snippet.title,
    thumbnail: item.snippet.thumbnails.medium.url
  }
}

async function fetchPlaylistVideoIds(playlistId) {
  const videoIds = []
  let pageToken

  do {
    const res = await axios.get("https://www.googleapis.com/youtube/v3/playlistItems", {
      params: {
        part: "contentDetails",
        playlistId,
        maxResults: 50,
        pageToken,
        key: YOUTUBE_API_KEY
      }
    })

    for (const item of res.data.items || []) {
      const id = item.contentDetails?.videoId
      if (id) videoIds.push(id)
    }

    pageToken = res.data.nextPageToken
  } while (pageToken)

  return videoIds
}

async function searchFirstVideoId(query) {
  const res = await axios.get("https://www.googleapis.com/youtube/v3/search", {
    params: {
      part: "id",
      q: query,
      type: "video",
      maxResults: 1,
      key: YOUTUBE_API_KEY
    }
  })

  const item = res.data.items?.[0]
  return item?.id?.videoId || null
}

async function resolveVideoIds(input) {
  const trimmed = input.trim()
  if (!trimmed) return []

  const playlistId = extractPlaylistId(trimmed)
  if (playlistId) {
    return fetchPlaylistVideoIds(playlistId)
  }

  const videoId = extractVideoId(trimmed)
  if (videoId) {
    return [videoId]
  }

  const searchId = await searchFirstVideoId(trimmed)
  return searchId ? [searchId] : []
}

module.exports = {
  fetchVideoInfo,
  resolveVideoIds
}