import React from 'react'
import { Text, FlatList, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'

import { useTheme } from '~/contexts/theme'
import useLyrics, { isBlankLine, isSynced } from '~/utils/useLyrics'
import Player from '~/utils/player'

/**
 * Lyrics that follow playback. Tap a line to jump to it.
 * With `onShareLine`, a long press on a line calls it with the line's index, to share it as an image.
 */
const Lyric = ({ song, style, color = null, sizeText = 23, onShareLine = null }) => {
	const { t } = useTranslation()
	const [indexCurrent, setIndex] = React.useState(0)
	const [isLayout, setIsLayout] = React.useState(false)
	const refScroll = React.useRef(null)
	const theme = useTheme()
	const time = Player.updateTime()
	const { status, lyrics: found } = useLyrics(song.songInfo)
	const synced = isSynced(found)

	const lyrics = React.useMemo(() => {
		if (status === 'loading') return [{ time: 0, text: t('Loading lyrics...') }]
		if (status === 'none') return [{ time: 0, text: t('No lyrics found') }]
		return found
	}, [status, found, t])

	React.useEffect(() => {
		if (!synced) return
		let index = lyrics.findIndex(ly => ly.time > time.position) - 1
		if (index === -1) index = 0
		if (index === -2) index = lyrics.length - 1
		if (index < 0) return
		if (index !== indexCurrent) {
			setIndex(index)
		}
	}, [time.position, lyrics, synced])

	React.useEffect(() => {
		if (!isLayout || !synced || indexCurrent >= lyrics.length) return
		refScroll.current?.scrollToIndex({ index: indexCurrent, animated: true, viewOffset: 0, viewPosition: 0.5 })
	}, [indexCurrent, isLayout, synced])

	const isActive = (index) => !synced || index === indexCurrent

	return (
		<FlatList
			ref={refScroll}
			style={[style, { borderRadius: null }]}
			contentContainerStyle={{ gap: 30 }}
			showsVerticalScrollIndicator={false}
			onScrollToIndexFailed={() => { }}
			initialNumToRender={lyrics.length}
			data={lyrics}
			onLayout={() => setIsLayout(true)}
			keyExtractor={(item, index) => index}
			renderItem={({ item, index }) => {
				const canShare = onShareLine && status === 'found' && !isBlankLine(item.text)
				return (
					<Pressable
						onPress={() => {
							if (synced) Player.setPosition(item.time)
						}}
						onLongPress={canShare ? () => onShareLine(index) : undefined}
						accessibilityHint={canShare ? t('shareLyrics.Long press hint') : undefined}
					>
						<Text
							style={{
								color: isActive(index) ? color?.active || theme.primaryText : color?.inactive || theme.secondaryText,
								fontSize: sizeText,
								textAlign: 'center',
							}}>
							{item.text.length ? item.text : '...'}
						</Text>
					</Pressable>
				)
			}}
		/>
	)
}

export default Lyric
