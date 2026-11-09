import React from 'react'
import { Text, View, Pressable, StyleSheet, PanResponder } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getColors } from 'react-native-image-colors'
import Icon from '~/components/Icon'

import { useSong, useSongDispatch } from '~/contexts/song'
import { useConfig } from '~/contexts/config'
import { useTheme, themes } from '~/contexts/theme'
import { urlCover } from '~/utils/url'
import PlayButton from '~/components/button/PlayButton'
import Player from '~/utils/player'
import IconButton from '~/components/button/IconButton'
import ImageError from '~/components/ImageError'
import size from '~/styles/size'
import useKeyboardIsOpen from '~/utils/useKeyboardIsOpen'

// Darkens a cover colour so its brightest channel is at most `max`. Kit: 55 for the background, 112 at .68 for the track.
const capColor = (hex, max, alpha = 1) => {
	const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
	const ratio = Math.min(1, max / Math.max(...rgb, 1))
	return `rgba(${rgb.map(c => Math.round(c * ratio)).join(',')},${alpha})`
}

// Main colour of the cover, or null when untinted. `fallback` is hex and comes back if extraction fails.
const useCoverTint = (uri, fallback, enabled) => {
	const [tint, setTint] = React.useState(null)

	React.useEffect(() => {
		if (!enabled || !uri) {
			setTint(null)
			return
		}
		let active = true
		getColors(uri, { fallback, cache: true, key: uri })
			.then(colors => {
				const color = colors.platform === 'ios' ? colors.background : colors.dominant
				if (active) setTint(/^#[0-9a-f]{6}/i.test(color) ? color : null)
			})
			.catch(() => { if (active) setTint(null) })
		return () => { active = false }
	}, [uri, fallback, enabled])

	return tint
}

// Thin line along the bottom edge of the mini player. Own component so only it re-renders on each tick.
const Progress = ({ track }) => {
	const song = useSong()
	const theme = useTheme()
	const time = Player.updateTime()
	const duration = time.duration > 0 && time.duration !== Infinity ? time.duration : song?.songInfo?.duration
	const ratio = duration ? Math.min(1, time.position / duration) : 0

	return (
		<View style={{ position: 'absolute', left: 10, right: 10, bottom: 0, height: 3, borderRadius: size.radius.sm, overflow: 'hidden', backgroundColor: track ?? theme.tertiaryBack }}>
			<View style={{ width: `${ratio * 100}%`, height: '100%', backgroundColor: theme.playerSecondaryText }} />
		</View>
	)
}

const BoxPlayer = ({ setFullScreen }) => {
	const song = useSong()
	const songDispatch = useSongDispatch()
	const config = useConfig()
	const insets = useSafeAreaInsets()
	const theme = useTheme()
	const isKeyboardOpen = useKeyboardIsOpen()
	const cover = urlCover(config, song?.songInfo, 100)
	// ponytail: Spotify theme only, other themes pair the player with text colours a dark tint would break
	const tint = useCoverTint(cover, theme.playerBackground, theme.playerBackground === themes.spotify.playerBackground)
	const latest = React.useRef({})
	latest.current = { config, song, songDispatch, setFullScreen }

	// Swipe up to open the full player, sideways to skip. A plain tap still opens it.
	const pan = React.useRef(PanResponder.create({
		onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 15 || g.dy < -15,
		onPanResponderRelease: (_, g) => {
			const { config, song, songDispatch, setFullScreen } = latest.current
			if (Math.abs(g.dx) > Math.abs(g.dy)) {
				if (g.dx < -60) Player.nextSong(config, song, songDispatch)
				else if (g.dx > 60) Player.previousSong(config, song, songDispatch)
			} else if (g.dy < -40) setFullScreen(true)
		},
	})).current

	return (
		<Pressable
			{...pan.panHandlers}
			onPress={() => setFullScreen(true)}
			style={{
				position: 'absolute',
				bottom: (insets.bottom ? insets.bottom : 10) + 59,
				left: insets.left,
				right: insets.right,

				flexDirection: 'row',
				alignItems: 'center',
				backgroundColor: tint ? capColor(tint, 55) : theme.playerBackground,
				paddingHorizontal: 10,
				paddingVertical: 7.5,
				marginHorizontal: 8,
				marginVertical: 10,
				borderRadius: size.radius.lg,
				display: isKeyboardOpen ? 'none' : undefined,
			}}>
			<ImageError
				source={{ uri: cover }}
				style={styles.boxPlayerImage}
			>
				<View style={styles.boxPlayerImage}>
					<Icon name="music" size={size.icon.small} color={theme.playerPrimaryText} />
				</View>
			</ImageError>
			<View style={{ flex: 1 }}>
				<Text style={{ color: theme.playerPrimaryText, textAlign: 'left', flex: 1, fontSize: 13.5, fontWeight: '600' }} numberOfLines={1}>{song?.songInfo?.title ? song.songInfo.title : 'Song title'}</Text>
				<Text style={{ color: theme.playerSecondaryText, textAlign: 'left', flex: 1, fontSize: size.text.caption, fontWeight: '500' }} numberOfLines={1}>{song?.songInfo?.artist ? song.songInfo.artist : 'Artist'}</Text>
			</View>
			<IconButton
				icon="step-forward"
				size={size.icon.small}
				color={theme.playerPrimaryText}
				style={{ width: 44, height: 44, alignItems: 'center' }}
				onPress={() => Player.nextSong(config, song, songDispatch)}
			/>
			<PlayButton
				size={size.icon.small}
				color={theme.playerPrimaryText}
				style={{ width: 44, height: 44, alignItems: 'center' }}
			/>
			<Progress track={tint ? capColor(tint, 112, 0.68) : undefined} />
		</Pressable>
	)
}

const styles = StyleSheet.create({
	boxPlayerImage: {
		height: size.image.player,
		width: size.image.player,
		marginRight: 10,
		borderRadius: 6,
		alignItems: 'center',
		justifyContent: 'center',
	},
})

export default BoxPlayer