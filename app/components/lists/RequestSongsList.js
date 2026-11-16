import React from 'react'
import { Text, View, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import Icon from '~/components/Icon'

import { useConfig } from '~/contexts/config'
import { useSongDispatch } from '~/contexts/song'
import { useTheme } from '~/contexts/theme'
import { addToQueue, playSong } from '~/utils/player'
import { JOB_STEPS } from '~/utils/songService'
import useSongRequests from '~/utils/useSongRequests'
import ImageError from '~/components/ImageError'
import mainStyles from '~/styles/main'
import size from '~/styles/size'

const duration = (ms) => {
	if (!ms) return ''
	const s = Math.round(ms / 1000)
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const Progress = ({ state }) => {
	const theme = useTheme()
	const step = JOB_STEPS.indexOf(state)

	return (
		<View style={{ flexDirection: 'row', gap: 3, marginTop: 4 }}>
			{JOB_STEPS.map((s, i) => (
				<View key={s} style={{
					flex: 1,
					height: 3,
					borderRadius: size.radius.sm,
					backgroundColor: i <= step ? theme.primaryTouch : theme.secondaryBack,
				}} />
			))}
		</View>
	)
}

/**
 * Songs from the full catalogue, via moderato-service. Tapping a row adds the song to
 * the library if needed and plays it as soon as Navidrome has it; the download button
 * only adds it.
 */
const RequestSongsList = ({ items, isIndex = false, getAllRef = null, showReason = false, onLongPress = null, requests = null }) => {
	const { t } = useTranslation()
	const theme = useTheme()
	const config = useConfig()
	const songDispatch = useSongDispatch()
	// A screen with several lists can pass one set of requests, so a song kept from a menu shows as kept in its row.
	const own = useSongRequests()
	const { jobs, latest, ensure, getSong, playItem } = requests ?? own

	/**
	 * Add every song. With `play`, also play them in list order: the first one starts as
	 * soon as it is ready, the rest join the queue as they arrive. The service downloads
	 * one at a time.
	 */
	const getAll = async ({ play = true } = {}) => {
		const pending = items.map((item) => ensure(item))
		if (!play) return
		const token = {}
		latest.current = token
		let started = false
		for (const p of pending) {
			const subsonicId = await p
			if (!subsonicId || latest.current !== token) continue
			const song = await getSong(subsonicId)
			if (!song) continue
			if (started) addToQueue(songDispatch, song)
			else playSong(config, songDispatch, [song], 0)
			started = true
		}
	}
	if (getAllRef) getAllRef.current = getAll

	const onPress = (item) => playItem(item)

	const add = (item, options) => {
		const current = jobs[item.id]
		if (current && !current.error) return
		ensure(item, options)
	}

	return (
		<View style={{ flexDirection: 'column', paddingHorizontal: size.margin }}>
			{items.map((item) => {
				const job = jobs[item.id]
				const inLibrary = item.cached || job?.state === 'done'
				const busy = job && !job.error && job.state !== 'done'
				// In the shared library, which rotates, until the user keeps it.
				const onlyShared = item.shared && job?.state !== 'done'

				return (
					<Pressable
						key={item.id}
						style={({ pressed }) => ([mainStyles.opacity({ pressed }), styles.row])}
						onPress={() => onPress(job?.subsonicId ? { ...item, cached: true, shared: false, subsonicId: job.subsonicId } : item)}
						onLongPress={onLongPress ? () => onLongPress(item) : undefined}
						disabled={busy}
						accessibilityLabel={inLibrary ? t('songService.Play title', { title: item.title }) : t('songService.Get and play title', { title: item.title })}
					>
						<View style={[mainStyles.coverSmall(theme), { overflow: 'hidden', marginRight: 10 }]}>
							<ImageError style={[mainStyles.coverSmall(theme)]} source={{ uri: item.coverUrl }} />
						</View>
						<View style={{ flex: 1, flexDirection: 'column' }}>
							<Text numberOfLines={1} style={[mainStyles.mediumText(theme.primaryText), { marginBottom: 2 }]}>
								{isIndex && item.trackNumber ? `${item.trackNumber}. ` : ''}{item.title}
							</Text>
							<Text numberOfLines={1} style={mainStyles.smallText(job?.error ? theme.primaryTouch : theme.secondaryText)}>
								{job?.error
									? job.error
									: busy
										? t(`songService.job.${job.state}`)
										: (showReason && item.reason
											? [item.artist, item.reason]
											: [item.artist, item.album, duration(item.durationMs)]
										).filter(Boolean).join(' · ')}
							</Text>
							{busy && <Progress state={job.state} />}
						</View>
						{onlyShared && !busy ? (
							<Pressable
								onPress={() => add(item, { keep: true })}
								hitSlop={10}
								style={({ pressed }) => ([mainStyles.opacity({ pressed }), styles.action])}
								accessibilityRole="button"
								accessibilityLabel={t('songService.Keep title', { title: item.title })}
							>
								<Icon name="bookmark" size={size.icon.tiny} color={theme.secondaryText} />
							</Pressable>
						) : inLibrary || busy ? (
							<Icon
								name={inLibrary ? 'check' : 'hourglass-half'}
								size={size.icon.tiny}
								color={inLibrary ? theme.primaryTouch : theme.secondaryText}
								style={styles.action}
								accessibilityLabel={inLibrary ? t('songService.In your library') : undefined}
							/>
						) : (
							<Pressable
								onPress={() => add(item)}
								hitSlop={10}
								style={({ pressed }) => ([mainStyles.opacity({ pressed }), styles.action])}
								accessibilityRole="button"
								accessibilityLabel={t('songService.Add title', { title: item.title })}
							>
								<Icon name="cloud-download" size={size.icon.tiny} color={theme.secondaryText} />
							</Pressable>
						)}
					</Pressable>
				)
			})}
		</View>
	)
}

const styles = StyleSheet.create({
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		minHeight: size.image.small,
		marginBottom: 10,
		borderRadius: size.radius.sm,
	},
	action: {
		padding: 5,
		paddingStart: 10,
	},
})

export default RequestSongsList
