import React from 'react'
import { View, Text, Image, Platform } from 'react-native'
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect } from 'react-native-svg'

import Icon from '~/components/Icon'
import { FONT } from '~/components/share/fonts'
import {
	BLOCK, FORMATS, GLOW, POLAROID, TYPE,
	cardFontSize, inkOn, mix, polaroidPaper, rgba,
} from '~/components/share/cardLayout'

/**
 * An image of song lyrics to share, in one of three styles: Glow, Block or Polaroid.
 * It is drawn at `width` points wide; every size scales with it, so a small preview and the
 * full-size image look the same. `onReady(true)` fires once its images have loaded.
 */

// Images each style shows, so the card knows when it is ready to capture.
const IMAGES = {
	glow: ['backdrop', 'thumb'],
	block: ['disc'],
	polaroid: ['photo'],
}

// The web capture cannot draw CSS blur, so on web the backdrop is blurred beforehand (see shareCover.web.js).
const BACKDROP_BLUR = Platform.OS === 'web' ? 0 : 30

const textProps = { allowFontScaling: false }

const Brand = ({ u, color }) => (
	<View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 * u, opacity: 0.7 }}>
		<Icon name="music" size={30 * u} color={color} />
		<Text {...textProps} style={{ color, fontSize: 28 * u, fontWeight: '600', includeFontPadding: false }}>Castafiore</Text>
	</View>
)

const Meta = ({ u, color, title, artist }) => (
	<View style={{ flex: 1, minWidth: 0, gap: 4 * u }}>
		<Text {...textProps} numberOfLines={1} style={{ color, fontSize: 40 * u, lineHeight: 48 * u, fontWeight: 'bold' }}>{title}</Text>
		{artist ? <Text {...textProps} numberOfLines={1} style={{ color, fontSize: 33 * u, lineHeight: 40 * u, opacity: 0.78 }}>{artist}</Text> : null}
	</View>
)

const Lines = ({ style, lines, size, u, color, align }) => {
	const type = TYPE[style]
	const font = { glow: FONT.display, block: FONT.block, polaroid: FONT.typed }[style]
	return lines.map((line, index) => (
		<Text
			{...textProps}
			key={index}
			style={{
				fontFamily: font,
				fontSize: size * u,
				lineHeight: size * type.lineHeight * u,
				letterSpacing: style === 'glow' ? -0.02 * size * u : 0,
				marginTop: index ? size * type.gap * u : 0,
				color,
				textAlign: align,
				includeFontPadding: false,
			}}
		>
			{type.upper ? line.toUpperCase() : line}
		</Text>
	))
}

const Glow = ({ ids, u, f, size, props, onLoad }) => {
	const { lines, title, artist, cover, backdrop, color, align, brand } = props
	const ink = inkOn(color)
	const end = mix(color, '#000000', ink === '#ffffff' ? 0.35 : 0)
	return (
		<>
			{backdrop ? (
				<Image
					source={{ uri: backdrop }}
					blurRadius={BACKDROP_BLUR}
					onLoadEnd={() => onLoad('backdrop')}
					resizeMode="cover"
					style={{ position: 'absolute', left: -160 * u, top: -160 * u, width: (f.w + 320) * u, height: (f.h + 320) * u }}
				/>
			) : null}
			<Svg width={f.w * u} height={f.h * u} style={{ position: 'absolute', top: 0, left: 0 }}>
				<Defs>
					<LinearGradient id={ids.tint} x1="0" y1="0" x2="0.14" y2="1">
						<Stop offset="0" stopColor={color} stopOpacity={0.3} />
						<Stop offset="0.5" stopColor={color} stopOpacity={0.62} />
						<Stop offset="1" stopColor={end} stopOpacity={0.9} />
					</LinearGradient>
				</Defs>
				<Rect width={f.w * u} height={f.h * u} fill={`url(#${ids.tint})`} />
			</Svg>
			<View style={{ flex: 1, paddingVertical: f.padV * u, paddingHorizontal: f.padH * u }}>
				<View style={{ height: GLOW.quote * u, overflow: 'hidden' }}>
					<Text {...textProps} style={{ fontFamily: FONT.display, fontSize: 260 * u, lineHeight: 260 * u, color: ink, opacity: 0.55, textAlign: align, includeFontPadding: false }}>{'“'}</Text>
				</View>
				<View style={{ flex: 1, justifyContent: 'center', paddingTop: GLOW.above * u, paddingBottom: GLOW.below * u, overflow: 'hidden' }}>
					<Lines style="glow" lines={lines} size={size} u={u} color={ink} align={align} />
				</View>
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: 30 * u, height: GLOW.thumb * u }}>
					{cover ? (
						<Image
							source={{ uri: cover }}
							onLoadEnd={() => onLoad('thumb')}
							style={{ width: GLOW.thumb * u, height: GLOW.thumb * u, borderRadius: 22 * u }}
						/>
					) : null}
					<Meta u={u} color={ink} title={title} artist={artist} />
					{brand ? <Brand u={u} color={ink} /> : null}
				</View>
			</View>
		</>
	)
}

const Block = ({ u, f, size, props, onLoad }) => {
	const { lines, title, artist, cover, color, align, brand } = props
	const ink = inkOn(color)
	const shade = ink === '#ffffff' ? '#ffffff' : '#000000'
	const ring = BLOCK.disc + BLOCK.ring * 2
	return (
		<>
			<Text {...textProps} style={{ position: 'absolute', top: -20 * u, left: 60 * u, fontFamily: FONT.block, fontSize: 620 * u, lineHeight: 700 * u, color: rgba(shade, 0.1), includeFontPadding: false }}>{'“'}</Text>
			<View style={{ flex: 1, paddingVertical: f.padV * u, paddingHorizontal: f.padH * u }}>
				<View style={{ flex: 1, justifyContent: 'flex-end', paddingTop: BLOCK.top * u, overflow: 'hidden' }}>
					<Lines style="block" lines={lines} size={size} u={u} color={ink} align={align} />
				</View>
				<View style={{ height: BLOCK.rule * u, borderRadius: 3 * u, marginTop: BLOCK.ruleAbove * u, marginBottom: BLOCK.ruleBelow * u, backgroundColor: rgba(shade, 0.28) }} />
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: 30 * u, height: ring * u }}>
					{cover ? (
						<View style={{ width: ring * u, height: ring * u, borderRadius: ring * u / 2, padding: BLOCK.ring * u, backgroundColor: rgba(shade, 0.18) }}>
							<Image
								source={{ uri: cover }}
								onLoadEnd={() => onLoad('disc')}
								style={{ width: BLOCK.disc * u, height: BLOCK.disc * u, borderRadius: BLOCK.disc * u / 2 }}
							/>
							<View style={{ position: 'absolute', width: 34 * u, height: 34 * u, borderRadius: 17 * u, left: (ring - 34) / 2 * u, top: (ring - 34) / 2 * u, backgroundColor: color }} />
						</View>
					) : null}
					<Meta u={u} color={ink} title={title} artist={artist} />
					{brand ? <Brand u={u} color={ink} /> : null}
				</View>
			</View>
		</>
	)
}

const Polaroid = ({ ids, u, f, size, props, format, onLoad }) => {
	const { lines, title, artist, cover, color, align, brand } = props
	const ink = inkOn(color)
	const paper = polaroidPaper(format)
	const [tapeW, tapeH] = POLAROID.tape
	const maxPaper = f.h - f.padV * 2 - (brand ? POLAROID.brand : 0)
	return (
		<>
			<Svg width={f.w * u} height={f.h * u} style={{ position: 'absolute', top: 0, left: 0 }}>
				<Defs>
					<RadialGradient id={ids.backdrop} cx="0.25" cy="0.15" r="0.95" fx="0.25" fy="0.15">
						<Stop offset="0" stopColor={mix(color, '#ffffff', 0.14)} />
						<Stop offset="0.5" stopColor={color} />
						<Stop offset="1" stopColor={mix(color, '#000000', 0.35)} />
					</RadialGradient>
				</Defs>
				<Rect width={f.w * u} height={f.h * u} fill={`url(#${ids.backdrop})`} />
			</Svg>
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 56 * u, paddingVertical: f.padV * u, paddingHorizontal: f.padH * u }}>
				<View style={{ transform: [{ rotate: '-2deg' }] }}>
					{/* A drawn shadow: platform shadows do not all show up in the captured image. */}
					<View style={{ position: 'absolute', top: 28 * u, left: 4 * u, right: -8 * u, bottom: -28 * u, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 8 * u }} />
					<View style={{ position: 'absolute', top: 12 * u, left: 2 * u, right: -4 * u, bottom: -12 * u, backgroundColor: 'rgba(0,0,0,0.14)', borderRadius: 4 * u }} />
					<View style={{
						width: paper.width * u,
						maxHeight: maxPaper * u,
						backgroundColor: '#fbfbf9',
						paddingTop: POLAROID.padTop * u,
						paddingHorizontal: POLAROID.padSide * u,
						paddingBottom: POLAROID.padBottom * u,
						gap: POLAROID.gap * u,
					}}>
						{cover ? (
							<Image
								source={{ uri: cover }}
								onLoadEnd={() => onLoad('photo')}
								resizeMode="cover"
								style={{ width: paper.inner * u, height: paper.photo * u }}
							/>
						) : <View style={{ width: paper.inner * u, height: paper.photo * u, backgroundColor: color }} />}
						<View style={{ flexShrink: 1, overflow: 'hidden' }}>
							<Lines style="polaroid" lines={lines} size={size} u={u} color="#1c1c1e" align={align} />
						</View>
						<Text {...textProps} numberOfLines={1} style={{ fontFamily: FONT.typedItalic, fontSize: 30 * u, lineHeight: POLAROID.sign * u, color: '#6a6a6e', textAlign: align === 'center' ? 'center' : 'right' }}>
							{[title, artist].filter(Boolean).join(', ')}
						</Text>
					</View>
					<View style={{ position: 'absolute', top: -34 * u, left: (paper.width - tapeW) / 2 * u, width: tapeW * u, height: tapeH * u, backgroundColor: 'rgba(240,236,220,0.62)', transform: [{ rotate: '5deg' }] }} />
				</View>
				{brand ? <Brand u={u} color={ink} /> : null}
			</View>
		</>
	)
}

const LyricCard = ({ ref, style = 'glow', format = 'story', width, onReady, ...props }) => {
	const f = FORMATS[format]
	const u = width / f.w
	const size = React.useMemo(() => cardFontSize(style, format, props.lines, props.brand), [style, format, props.lines, props.brand])
	const rawId = React.useId().replace(/[^a-zA-Z0-9]/g, '')
	const ids = { tint: `tint${rawId}`, backdrop: `backdrop${rawId}` }

	// Which images have loaded, per style and cover, so a capture waits for them.
	const key = `${style}|${props.cover}|${props.backdrop}`
	const [loaded, setLoaded] = React.useState({})
	const needed = props.cover ? IMAGES[style] : []
	const ready = needed.every((name) => loaded[`${key}|${name}`])
	const onLoad = React.useCallback((name) => setLoaded((prev) => (
		prev[`${key}|${name}`] ? prev : { ...prev, [`${key}|${name}`]: true }
	)), [key])
	React.useEffect(() => { onReady?.(ready) }, [ready])

	const Style = { glow: Glow, block: Block, polaroid: Polaroid }[style]
	return (
		<View
			ref={ref}
			collapsable={false}
			style={{ width: f.w * u, height: f.h * u, overflow: 'hidden', backgroundColor: props.color }}
		>
			<Style ids={ids} u={u} f={f} size={size} props={props} format={format} onLoad={onLoad} />
		</View>
	)
}

export default LyricCard
