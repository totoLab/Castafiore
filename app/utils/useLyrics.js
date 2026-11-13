import React from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { useConfig } from '~/contexts/config'
import { getApi } from '~/utils/api'
import { parseLrc, parsePlain } from '~/utils/lrc'

/**
 * Lyrics of a song, as `[{ time, text }]` sorted by time. `time` is in seconds, or null for lyrics with no timing.
 * They come from the saved copy, then the server (OpenSubsonic getLyricsBySongId), then LRCLIB.
 * Found lyrics are saved, so the player and the share screen load them once.
 */

// Loads per server and song: `{ promise, lyrics }`, where `lyrics` is set once the promise resolves.
// Shared by every useLyrics, so the player and the share screen fetch once. Songs with no lyrics are remembered too.
const memory = new Map()
const MEMORY_SIZE = 200
const keyOf = (config, song) => `${config?.url}|${song.id}`

const fromServer = async (config, song) => {
	const res = await getApi(config, 'getLyricsBySongId', { id: song.id })
	const list = res?.lyricsList?.structuredLyrics || []
	const lyrics = list.find((ly) => ly.synced) || list[0]
	if (!lyrics?.line?.length) return []
	const lines = lyrics.line.map((ly) => ({
		time: lyrics.synced && ly.start != null ? ly.start / 1000 : null,
		text: ly.value?.length ? ly.value : '...',
	}))
	if (lyrics.synced) lines.sort((a, b) => a.time - b.time)
	return lines
}

const fromLrcLib = async (song) => {
	const params = {
		track_name: song.title,
		artist_name: song.artist,
		album_name: song.album,
		duration: song.duration,
	}
	const query = Object.keys(params).map((key) => `${key}=${encodeURIComponent(params[key])}`).join('&')
	const res = await fetch('https://lrclib.net/api/get?' + query, {
		headers: { 'Lrclib-Client': 'Castafiore' }
	})
	if (!res.ok) return []
	const json = await res.json()
	const synced = parseLrc(json.syncedLyrics)
	return synced.length ? synced : parsePlain(json.plainLyrics)
}

// Looser than fromLrcLib: matches on title and artist only, so a different album or duration still finds them.
const searchLrcLib = async (song) => {
	const query = `track_name=${encodeURIComponent(song.title)}&artist_name=${encodeURIComponent(song.artist || '')}`
	const res = await fetch('https://lrclib.net/api/search?' + query, {
		headers: { 'Lrclib-Client': 'Castafiore' }
	})
	if (!res.ok) return []
	const results = await res.json()
	const hit = results.find((r) => r.syncedLyrics) || results.find((r) => r.plainLyrics)
	if (!hit) return []
	const synced = parseLrc(hit.syncedLyrics)
	return synced.length ? synced : parsePlain(hit.plainLyrics)
}

const fetchLyrics = async (config, song) => {
	const saved = await AsyncStorage.getItem(`lyrics/${song.id}`).catch(() => null)
	if (saved) {
		try {
			const lyrics = JSON.parse(saved)
			if (Array.isArray(lyrics) && lyrics.length) return lyrics
		} catch { /* a broken saved copy is fetched again */ }
	}
	let lyrics = await fromServer(config, song).catch(() => [])
	if (!lyrics.length) {
		// LRCLIB out of reach is not an answer, so the next try asks again.
		lyrics = await fromLrcLib(song)
	}
	if (lyrics.length) AsyncStorage.setItem(`lyrics/${song.id}`, JSON.stringify(lyrics)).catch(() => { })
	return lyrics
}

export const loadLyrics = (config, song) => {
	const key = keyOf(config, song)
	if (!memory.has(key)) {
		// ponytail: oldest-first eviction, not LRU; fine at 200 songs.
		if (memory.size >= MEMORY_SIZE) memory.delete(memory.keys().next().value)
		const entry = {}
		entry.promise = fetchLyrics(config, song).then(
			(lyrics) => (entry.lyrics = lyrics),
			() => {
				memory.delete(key)
				return []
			},
		)
		memory.set(key, entry)
	}
	return memory.get(key).promise
}

/** True for lines with no words: gaps between verses, and the "..." placeholder shown for them. */
export const isBlankLine = (text) => !text || /^[\s.…♪♫-]*$/.test(text)

/** Lyrics are synced when their lines carry a time. */
export const isSynced = (lyrics) => lyrics.length > 0 && lyrics.every((ly) => typeof ly.time === 'number' && !isNaN(ly.time))

/** `{ status, lyrics }`, where status is 'loading', 'found' or 'none'. */
const useLyrics = (song) => {
	const config = useConfig()
	const key = song?.id ? keyOf(config, song) : null
	const known = (k) => (k ? memory.get(k)?.lyrics : undefined)
	const stateOf = (k, lyrics) => (lyrics
		? { key: k, status: lyrics.length ? 'found' : 'none', lyrics }
		: { key: k, status: 'loading', lyrics: [] })
	const [state, setState] = React.useState(() => stateOf(key, known(key)))

	React.useEffect(() => {
		if (!key) return
		let active = true
		setState(stateOf(key, known(key)))
		loadLyrics(config, song).then((lyrics) => {
			if (active) setState(stateOf(key, lyrics))
		})
		return () => { active = false }
	}, [key])

	// Runs a looser LRCLIB search; found lyrics are saved like any others.
	const search = async () => {
		if (!key) return
		setState({ key, status: 'loading', lyrics: [] })
		const lyrics = await searchLrcLib(song).catch(() => [])
		if (lyrics.length) {
			AsyncStorage.setItem(`lyrics/${song.id}`, JSON.stringify(lyrics)).catch(() => { })
			memory.set(key, { promise: Promise.resolve(lyrics), lyrics })
		}
		setState((s) => (s.key === key ? stateOf(key, lyrics) : s))
	}

	// Until the effect runs for a new song, the previous song's lyrics must not show.
	if (state.key !== key) return { status: 'loading', lyrics: [], search }
	return { ...state, search }
}

export default useLyrics
