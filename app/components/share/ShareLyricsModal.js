import React from 'react'
import { View, Text, Modal, FlatList, Pressable, ActivityIndicator, PixelRatio, Platform, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { useConfig } from '~/contexts/config'
import { useTheme } from '~/contexts/theme'
import { CARD_WIDTH, FORMATS, MAX_CHARS, MAX_LINES, STYLES } from '~/components/share/cardLayout'
import { useCardFonts } from '~/components/share/fonts'
import { isReducedMotion } from '~/utils/reducedMotion'
import { captureImage, shareImage } from '~/utils/shareImage'
import Icon from '~/components/Icon'
import IconButton from '~/components/button/IconButton'
import logger from '~/utils/logger'
import LyricCard from '~/components/share/LyricCard'
import Player from '~/utils/player'
import size from '~/styles/size'
import useCoverPalette from '~/utils/useCoverPalette'
import useLyrics, { isBlankLine, isSynced } from '~/utils/useLyrics'
import useShareCover from '~/utils/shareCover'

const PREFS_KEY = 'shareLyrics/prefs'
const DEFAULT_PREFS = { style: 'glow', format: 'story', align: 'left', brand: true }

// Saved prefs may come from another version of the app: keep only values this one knows.
const checkPrefs = (saved) => ({
	style: STYLES.includes(saved?.style) ? saved.style : DEFAULT_PREFS.style,
	format: Object.keys(FORMATS).includes(saved?.format) ? saved.format : DEFAULT_PREFS.format,
	align: ['left', 'center'].includes(saved?.align) ? saved.align : DEFAULT_PREFS.align,
	brand: typeof saved?.brand === 'boolean' ? saved.brand : DEFAULT_PREFS.brand,
})

// How long the card's images may take to load before the share gives up.
const IMAGE_TIMEOUT = 15000

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const CAN_SHARE_FILES = (() => {
	if (Platform.OS !== 'web') return true
	try {
		return !!navigator.canShare?.({ files: [new File([''], 'lyrics.png', { type: 'image/png' })] })
	} catch {
		return false
	}
})()

const fileName = (title) => `${(title || 'lyrics').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'lyrics'}-lyrics.png`

// The first line with words at `index`, or after it, or else before it.
const nearestLine = (lyrics, index) => {
	for (let i = Math.max(0, index); i < lyrics.length; i++) if (!isBlankLine(lyrics[i].text)) return i
	for (let i = Math.min(index, lyrics.length - 1); i >= 0; i--) if (!isBlankLine(lyrics[i].text)) return i
	return -1
}

// Picks the line being sung, to start with. Its own component so only it follows playback.
// On native the position reads 0 until the first poll, so it waits for a position, or a moment if playback sits at 0.
const PlaybackLine = ({ lyrics, onPick }) => {
	const { position } = Player.updateTime()
	const [waited, setWaited] = React.useState(false)
	React.useEffect(() => {
		const timer = setTimeout(() => setWaited(true), 1500)
		return () => clearTimeout(timer)
	}, [])
	const known = position > 0
	React.useEffect(() => {
		if (!known && !waited) return
		const next = lyrics.findIndex((ly) => ly.time > position)
		const index = next === -1 ? lyrics.length - 1 : Math.max(0, next - 1)
		onPick(nearestLine(lyrics, index))
	}, [known, waited])
	return null
}

const Segmented = ({ items, value, onChange, label }) => {
	const theme = useTheme()
	return (
		<View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', backgroundColor: theme.secondaryBack, borderRadius: size.radius.md, padding: 3 }}>
			{items.map((item) => {
				const selected = item.value === value
				return (
					<Pressable
						key={item.value}
						accessibilityRole="radio"
						accessibilityState={{ selected }}
						onPress={() => onChange(item.value)}
						style={{ flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: size.radius.md - 2, backgroundColor: selected ? theme.tertiaryBack : 'transparent' }}
					>
						<Text style={{ color: selected ? theme.primaryText : theme.secondaryText, fontSize: size.text.small, fontWeight: '600' }}>{item.label}</Text>
						{item.detail ? <Text style={{ color: selected ? theme.primaryText : theme.secondaryText, fontSize: size.text.tiny, opacity: 0.7 }}>{item.detail}</Text> : null}
					</Pressable>
				)
			})}
		</View>
	)
}

const ToolButton = ({ icon, label, active, onPress }) => {
	const theme = useTheme()
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={onPress}
			style={{ width: 38, height: 34, borderRadius: size.radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? theme.tertiaryBack : theme.secondaryBack }}
		>
			<Icon name={icon} size={18} color={active ? theme.primaryText : theme.secondaryText} />
		</Pressable>
	)
}

const ShareLyrics = ({ song: playing, initialIndex, onClose }) => {
	// The song when the screen opened. The player may move on, but the picked lines belong to this one.
	const [song] = React.useState(playing)
	const { t } = useTranslation()
	const theme = useTheme()
	const config = useConfig()
	const insets = useSafeAreaInsets()
	const { width, height } = useWindowDimensions()
	const fontsReady = useCardFonts()
	const { status, lyrics } = useLyrics(song)
	const synced = isSynced(lyrics)
	const coverState = useShareCover(config, song)
	const palette = useCoverPalette(coverState.colorSource)

	const [prefs, setPrefs] = React.useState(null)
	const [colorIndex, setColorIndex] = React.useState(0)
	const [sel, setSel] = React.useState(null)
	const [limit, setLimit] = React.useState(null)
	const [note, setNote] = React.useState(null)
	const [busy, setBusy] = React.useState(false)
	const [cardReady, setCardReady] = React.useState(false)
	const [image, setImage] = React.useState(null)
	const captureView = React.useRef(null)
	const captureReady = React.useRef(false)
	const listRef = React.useRef(null)
	const scrolled = React.useRef(false)
	const limitTimer = React.useRef(null)

	React.useEffect(() => {
		AsyncStorage.getItem(PREFS_KEY)
			.then((saved) => setPrefs(checkPrefs(saved ? JSON.parse(saved) : null)))
			.catch(() => setPrefs(DEFAULT_PREFS))
		return () => clearTimeout(limitTimer.current)
	}, [])

	const updatePrefs = (change) => {
		const next = { ...prefs, ...change }
		setPrefs(next)
		AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => { })
	}

	// Start with the line that was long-pressed, else the line being sung, else the first line.
	React.useEffect(() => {
		if (status !== 'found' || sel) return
		if (initialIndex != null && lyrics[initialIndex] && !isBlankLine(lyrics[initialIndex].text)) {
			setSel([initialIndex, initialIndex])
		} else if (!synced) {
			const first = nearestLine(lyrics, 0)
			if (first >= 0) setSel([first, first])
		}
	}, [status, lyrics])

	const pickFromPlayback = React.useCallback((index) => {
		if (index >= 0) setSel((prev) => prev ?? [index, index])
	}, [])

	const lines = React.useMemo(() => (
		sel ? lyrics.slice(sel[0], sel[1] + 1).map((ly) => ly.text).filter((text) => !isBlankLine(text)) : []
	), [lyrics, sel])

	const showLimit = (message) => {
		setLimit(message)
		clearTimeout(limitTimer.current)
		limitTimer.current = setTimeout(() => setLimit(null), 1600)
	}

	// Lines are picked as one block: a tap next to it grows it, a tap on either end shrinks it, any other tap starts again.
	const tapLine = (index) => {
		const step = (from, dir) => {
			let i = from + dir
			while (i >= 0 && i < lyrics.length && isBlankLine(lyrics[i].text)) i += dir
			return i
		}
		let [start, end] = sel ?? [index, index]
		if (sel && index >= start && index <= end) {
			if (start === end) return
			if (index === start) start = step(start, 1)
			else if (index === end) end = step(end, -1)
			else start = end = index
		} else if (sel && index === step(end, 1)) end = index
		else if (sel && index === step(start, -1)) start = index
		else start = end = index

		const picked = lyrics.slice(start, end + 1).map((ly) => ly.text).filter((text) => !isBlankLine(text))
		if (picked.length > MAX_LINES) return showLimit(t('shareLyrics.Too many lines', { max: MAX_LINES }))
		if (picked.join(' ').length > MAX_CHARS) return showLimit(t('shareLyrics.Too long', { max: MAX_CHARS }))
		setLimit(null)
		setNote(null)
		setSel([start, end])
	}

	const ready = fontsReady && prefs && coverState.ready && lines.length > 0
	const format = FORMATS[prefs?.format ?? 'story']
	const color = palette[Math.min(colorIndex, palette.length - 1)]
	const cardProps = prefs && {
		style: prefs.style,
		format: prefs.format,
		align: prefs.align,
		brand: prefs.brand,
		lines,
		title: song.title,
		artist: song.displayArtist || song.artist,
		cover: coverState.cover,
		backdrop: coverState.backdrop,
		color,
	}

	const contentWidth = Math.min(width, 520)
	const previewHeight = Math.min(Math.round(height * 0.34), 340)
	const previewWidth = Math.min(previewHeight * format.w / format.h, contentWidth - 32)
	// Drawn at 1080 device pixels wide, so the capture needs no scaling.
	const captureWidth = CARD_WIDTH / PixelRatio.get()

	const makeImage = async () => {
		const start = Date.now()
		while (!captureReady.current) {
			if (Date.now() - start > IMAGE_TIMEOUT) throw new Error('The card images did not load.')
			await wait(100)
		}
		await wait(80) // lets the last layout reach the screen
		return captureImage(captureView, { width: format.w, height: format.h })
	}

	// On web the image is made ahead of the tap: browsers open the share sheet only straight after one.
	React.useEffect(() => {
		setImage(null)
		if (Platform.OS !== 'web' || !ready || !cardReady) return
		let active = true
		const timer = setTimeout(() => {
			makeImage()
				.then((uri) => { if (active) setImage(uri) })
				.catch((error) => logger.error('shareLyrics', `${error}`)) // the tap tries again
		}, 150)
		return () => {
			active = false
			clearTimeout(timer)
		}
	}, [ready, cardReady, prefs, lines, color, coverState.cover, coverState.backdrop])

	const share = async () => {
		if (busy || !ready) return
		setBusy(true)
		setNote(null)
		try {
			const uri = image || await makeImage()
			const result = await shareImage(uri, { title: t('shareLyrics.Share lyrics'), fileName: fileName(song.title) })
			if (result === 'downloaded') setNote(t('shareLyrics.Image downloaded'))
		} catch (error) {
			logger.error('shareLyrics', `${error}`)
			setNote(t('shareLyrics.Could not make the image'))
		} finally {
			setBusy(false)
		}
	}

	const scrollToSelection = () => {
		if (scrolled.current || !sel || !listRef.current) return
		scrolled.current = true
		listRef.current.scrollToIndex({ index: sel[0], viewPosition: 0.3, animated: false })
	}
	React.useEffect(scrollToSelection, [sel])

	return (
		<View style={{ flex: 1, backgroundColor: theme.primaryBack, overflow: 'hidden' }}>
			{/* The full-size card that gets captured. It sits under the screen, so only the preview shows. */}
			{ready ? (
				<View style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
					<LyricCard ref={captureView} {...cardProps} width={captureWidth} onReady={(isReady) => {
						captureReady.current = isReady
						setCardReady(isReady)
					}} />
				</View>
			) : null}

			<View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.primaryBack, paddingTop: insets.top, paddingBottom: insets.bottom, alignItems: 'center' }}>
				{status === 'found' && synced && !sel ? <PlaybackLine lyrics={lyrics} onPick={pickFromPlayback} /> : null}
				<View style={{ flex: 1, width: '100%', maxWidth: 520 }}>
					<View style={{ flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: 6 }}>
						<IconButton icon="close" color={theme.primaryText} style={{ padding: 12 }} onPress={onClose} />
						<Text accessibilityRole="header" style={{ flex: 1, textAlign: 'center', color: theme.primaryText, fontSize: size.text.medium, fontWeight: '600' }}>{t('shareLyrics.Share lyrics')}</Text>
						<View style={{ width: 48 }} />
					</View>

					<View style={{ height: previewHeight + 16, alignItems: 'center', justifyContent: 'center' }}>
						{ready ? (
							<View style={{ borderRadius: 6, overflow: 'hidden', boxShadow: '0 10px 28px rgba(0,0,0,0.55)' }}>
								<LyricCard {...cardProps} width={previewWidth} />
							</View>
						) : status === 'none' ? null : <ActivityIndicator color={theme.secondaryText} />}
					</View>

					{prefs ? (
						<View style={{ gap: 10, paddingHorizontal: 16, paddingBottom: 12 }}>
							<Segmented
								label={t('shareLyrics.Style')}
								value={prefs.style}
								onChange={(style) => updatePrefs({ style })}
								items={STYLES.map((style) => ({ value: style, label: t(`shareLyrics.style.${style}`) }))}
							/>
							<Segmented
								label={t('shareLyrics.Format')}
								value={prefs.format}
								onChange={(format) => updatePrefs({ format })}
								items={Object.entries(FORMATS).map(([key, f]) => ({ value: key, label: t(`shareLyrics.format.${key}`), detail: f.ratio }))}
							/>
							<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
								<View accessibilityRole="radiogroup" accessibilityLabel={t('shareLyrics.Colour')} style={{ flexDirection: 'row', gap: 10 }}>
									{palette.map((swatch, index) => (
										<Pressable
											key={swatch}
											accessibilityRole="radio"
											accessibilityLabel={t('shareLyrics.Colour number', { number: index + 1 })}
											accessibilityState={{ selected: index === colorIndex }}
											onPress={() => setColorIndex(index)}
											style={{ width: 30, height: 30, borderRadius: 15, padding: 2, borderWidth: 2, borderColor: index === colorIndex ? theme.primaryText : 'transparent' }}
										>
											<View style={{ flex: 1, borderRadius: 13, backgroundColor: swatch, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }} />
										</Pressable>
									))}
								</View>
								<View style={{ flexDirection: 'row', gap: 6 }}>
									<ToolButton
										icon={prefs.align === 'center' ? 'text-center' : 'text-left'}
										label={t(prefs.align === 'center' ? 'shareLyrics.Align left' : 'shareLyrics.Centre text')}
										active={prefs.align === 'center'}
										onPress={() => updatePrefs({ align: prefs.align === 'center' ? 'left' : 'center' })}
									/>
									<ToolButton
										icon="music"
										label={t(prefs.brand ? 'shareLyrics.Hide mark' : 'shareLyrics.Show mark')}
										active={prefs.brand}
										onPress={() => updatePrefs({ brand: !prefs.brand })}
									/>
								</View>
							</View>
						</View>
					) : null}

					<View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6, borderTopWidth: 1, borderTopColor: theme.secondaryBack }}>
						<Text style={{ color: theme.secondaryText, fontSize: size.text.caption }}>{t('shareLyrics.Tap lines')}</Text>
						<Text accessibilityLiveRegion="polite" style={{ color: limit ? theme.danger ?? '#dc3545' : theme.secondaryText, fontSize: size.text.caption, fontVariant: ['tabular-nums'] }}>
							{limit ?? t('shareLyrics.Lines picked', { count: lines.length, max: MAX_LINES })}
						</Text>
					</View>

					{status === 'found' ? (
						<FlatList
							ref={listRef}
							style={{ flex: 1 }}
							contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 12, gap: 2 }}
							data={lyrics}
							keyExtractor={(_, index) => String(index)}
							initialNumToRender={lyrics.length}
							onLayout={scrollToSelection}
							onScrollToIndexFailed={({ index, averageItemLength }) => listRef.current?.scrollToOffset({ offset: Math.max(0, index * averageItemLength - 80), animated: false })}
							renderItem={({ item, index }) => {
								if (isBlankLine(item.text)) return <View style={{ height: 10 }} />
								const selected = sel && index >= sel[0] && index <= sel[1]
								return (
									<Pressable
										accessibilityRole="checkbox"
										accessibilityState={{ checked: !!selected }}
										onPress={() => tapLine(index)}
										style={{
											paddingVertical: 8,
											paddingHorizontal: 12,
											borderRadius: size.radius.md,
											borderLeftWidth: 3,
											borderLeftColor: selected ? theme.primaryTouch : 'transparent',
											backgroundColor: selected ? theme.secondaryBack : 'transparent',
										}}
									>
										<Text style={{ color: selected ? theme.primaryText : theme.secondaryText, fontSize: size.text.medium, fontWeight: '500' }}>{item.text}</Text>
									</Pressable>
								)
							}}
						/>
					) : (
						<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
							{status === 'loading'
								? <ActivityIndicator color={theme.secondaryText} />
								: <Text style={{ color: theme.secondaryText, fontSize: size.text.medium, textAlign: 'center' }}>{t('shareLyrics.No lyrics')}</Text>}
						</View>
					)}

					<View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14, gap: 8, borderTopWidth: 1, borderTopColor: theme.secondaryBack }}>
						{note ? <Text accessibilityLiveRegion="polite" style={{ color: theme.secondaryText, fontSize: size.text.small, textAlign: 'center' }}>{note}</Text> : null}
						<Pressable
							accessibilityRole="button"
							accessibilityState={{ disabled: !ready || busy, busy }}
							disabled={!ready || busy}
							onPress={share}
							style={({ pressed }) => ({
								flexDirection: 'row',
								alignItems: 'center',
								justifyContent: 'center',
								gap: 8,
								paddingVertical: 13,
								borderRadius: size.radius.circle,
								backgroundColor: theme.primaryTouch,
								opacity: !ready ? 0.4 : pressed ? 0.8 : 1,
							})}
						>
							{busy
								? <ActivityIndicator size="small" color={theme.innerTouch} />
								: <Icon name={CAN_SHARE_FILES ? 'share' : 'download'} size={18} color={theme.innerTouch} />}
							<Text style={{ color: theme.innerTouch, fontSize: size.text.medium, fontWeight: '600' }}>
								{busy ? t('shareLyrics.Making image') : t(CAN_SHARE_FILES ? 'shareLyrics.Share image' : 'shareLyrics.Download image')}
							</Text>
						</Pressable>
					</View>
				</View>
			</View>
		</View>
	)
}

/**
 * Turns a few lines of a song's lyrics into an image to post: pick the lines, a style, a format and a colour,
 * then share it. `initialIndex` is the lyric line to start with, if any.
 */
const ShareLyricsModal = ({ song, visible, initialIndex = null, onClose }) => {
	if (!visible || !song) return null
	return (
		<Modal
			visible={visible}
			animationType={isReducedMotion() ? 'none' : 'slide'}
			statusBarTranslucent={true}
			onRequestClose={onClose}
		>
			<ShareLyrics song={song} initialIndex={initialIndex} onClose={onClose} />
		</Modal>
	)
}

export default ShareLyricsModal
