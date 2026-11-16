import React from 'react'
import { useTranslation } from 'react-i18next'

import { useConfig } from '~/contexts/config'
import { useSettings } from '~/contexts/settings'
import { useSongDispatch } from '~/contexts/song'
import { getApi } from '~/utils/api'
import { playSong } from '~/utils/player'
import { fetchSong } from '~/utils/songService'

/**
 * Songs from the song service that may not be on the server yet: adds one to the library when needed
 * and plays it. Keeps the state of each request by track id, for lists that show its progress.
 * Songs in the server's shared library play from there; `keep` asks for a copy in the user's own library
 * (the service links the file, so it is instant and costs no disk), which survives the shared one rotating out.
 */
const useSongRequests = () => {
	const { t } = useTranslation()
	const config = useConfig()
	const settings = useSettings()
	const songDispatch = useSongDispatch()
	const [jobs, setJobs] = React.useState({})
	// Only the most recent tap starts playback, so an earlier request that finishes late does not interrupt.
	const latest = React.useRef(null)

	const setJob = (id, value) => setJobs((prev) => ({ ...prev, [id]: value }))

	const getSong = (subsonicId) =>
		getApi(config, 'getSong', { id: subsonicId }).then((json) => json?.song).catch(() => null)

	const play = async (subsonicId) => {
		const song = await getSong(subsonicId)
		if (song) playSong(config, songDispatch, [song], 0)
	}

	/** Resolves with the song's Subsonic id once it is playable, or null if it could not be added. */
	const ensure = async (item, { keep = false } = {}) => {
		const current = jobs[item.id]
		if (item.cached && item.subsonicId && !(keep && item.shared)) return item.subsonicId
		if (current?.subsonicId) return current.subsonicId
		try {
			setJob(item.id, { state: 'queued' })
			const subsonicId = await fetchSong(settings, item.id, (job) => setJob(item.id, { state: job.state }))
			setJob(item.id, { state: 'done', subsonicId })
			return subsonicId
		} catch (error) {
			setJob(item.id, { error: error?.message ?? t('songService.job.failed') })
			return null
		}
	}

	/** Tap: add if needed, then play, unless a later tap came in meanwhile. */
	const playItem = async (item) => {
		const current = jobs[item.id]
		if (current && !current.error && current.state !== 'done') return
		latest.current = item.id
		const subsonicId = await ensure(item)
		if (subsonicId && latest.current === item.id) await play(subsonicId)
	}

	return { jobs, latest, ensure, getSong, play, playItem }
}

export default useSongRequests
