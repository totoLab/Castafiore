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

const memory = new Map()

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

export const loadLyrics = async (config, song) => {
	if (memory.has(song.id)) return memory.get(song.id)
	const saved = await AsyncStorage.getItem(`lyrics/${song.id}`).catch(() => null)
	if (saved) {
		try {
			const lyrics = JSON.parse(saved)
			if (Array.isArray(lyrics) && lyrics.length) {
				memory.set(song.id, lyrics)
				return lyrics
			}
		} catch { /* a broken saved copy is fetched again */ }
	}
	let lyrics = await fromServer(config, song).catch(() => [])
	if (!lyrics.length) lyrics = await fromLrcLib(song).catch(() => [])
	if (lyrics.length) {
		memory.set(song.id, lyrics)
		AsyncStorage.setItem(`lyrics/${song.id}`, JSON.stringify(lyrics)).catch(() => { })
	}
	return lyrics
}

/** True for lines with no words: gaps between verses, and the "..." placeholder shown for them. */
export const isBlankLine = (text) => !text || /^[\s.…♪♫-]*$/.test(text)

/** Lyrics are synced when their lines carry a time. */
export const isSynced = (lyrics) => lyrics.length > 0 && lyrics.every((ly) => typeof ly.time === 'number' && !isNaN(ly.time))

/** `{ status, lyrics }`, where status is 'loading', 'found' or 'none'. */
const useLyrics = (song) => {
	const config = useConfig()
	const [state, setState] = React.useState(() => (
		song?.id && memory.has(song.id)
			? { id: song.id, status: 'found', lyrics: memory.get(song.id) }
			: { id: song?.id, status: 'loading', lyrics: [] }
	))

	React.useEffect(() => {
		if (!song?.id) return
		let active = true
		if (memory.has(song.id)) {
			setState({ id: song.id, status: 'found', lyrics: memory.get(song.id) })
			return
		}
		setState({ id: song.id, status: 'loading', lyrics: [] })
		loadLyrics(config, song)
			.then((lyrics) => {
				if (active) setState({ id: song.id, status: lyrics.length ? 'found' : 'none', lyrics })
			})
			.catch(() => {
				if (active) setState({ id: song.id, status: 'none', lyrics: [] })
			})
		return () => { active = false }
	}, [song?.id])

	// Until the effect runs for a new song, the previous song's lyrics must not show.
	if (state.id !== song?.id) return { status: 'loading', lyrics: [] }
	return state
}

export default useLyrics
