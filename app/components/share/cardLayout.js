import metrics from '~/components/share/fontMetrics'

/**
 * Sizes and colours of the lyric cards. Every length is in pixels of the shared image, which is 1080 wide;
 * a card drawn at another width multiplies them by `width / 1080`. The preview and the shared image use
 * the same numbers, so what you see is what is shared.
 */

export const CARD_WIDTH = 1080
export const MAX_LINES = 6
export const MAX_CHARS = 280

export const FORMATS = {
	story: { label: 'Story', ratio: '9:16', w: 1080, h: 1920, padV: 130, padH: 96, glow: 112, block: 172, polaroid: 56 },
	post: { label: 'Post', ratio: '4:5', w: 1080, h: 1350, padV: 96, padH: 88, glow: 96, block: 140, polaroid: 50 },
	square: { label: 'Square', ratio: '1:1', w: 1080, h: 1080, padV: 80, padH: 80, glow: 82, block: 118, polaroid: 44 },
}

export const STYLES = ['glow', 'block', 'polaroid']

// Lyric type, per style. `font` names a table in fontMetrics.
export const TYPE = {
	glow: { font: 'display', lineHeight: 1.14, gap: 0.12 },
	block: { font: 'block', lineHeight: 1.1, gap: 0.04, upper: true },
	polaroid: { font: 'typed', lineHeight: 1.38, gap: 0.15 },
}

// Fixed parts of each layout.
export const GLOW = { quote: 130, above: 30, below: 60, thumb: 150 }
export const BLOCK = { top: 40, ruleAbove: 56, rule: 6, ruleBelow: 48, disc: 170, ring: 6 }
export const POLAROID = { padTop: 44, padSide: 44, padBottom: 50, gap: 40, sign: 40, brand: 90, tape: [230, 70] }

export const polaroidPaper = (format) => {
	const f = FORMATS[format]
	const width = format === 'square' ? 760 : 820
	const inner = width - POLAROID.padSide * 2
	const photo = Math.round(Math.min(inner, f.h * (format === 'story' ? 0.36 : 0.3)))
	return { width, inner, photo }
}

// ---------- text fitting ----------

const AVERAGE = Object.fromEntries(Object.entries(metrics).map(([font, widths]) => {
	const letters = widths.slice(65, 91) // a to z
	return [font, letters.reduce((a, b) => a + b, 0) / letters.length]
}))

const charWidth = (font, char) => {
	const code = char.codePointAt(0)
	if (code >= 32 && code <= 126) return metrics[font][code - 32]
	if (code >= 0x2e80) return 1 // CJK and other full-width characters
	return AVERAGE[font]
}

// Glyph widths differ a little between platforms (hinting, kerning), so text is measured a bit wider than it is.
const SAFETY = 1.05

const textWidth = (font, text) => {
	let width = 0
	for (const char of text) width += charWidth(font, char)
	return width * SAFETY
}

/** How many rows a line takes once wrapped at `maxWidth`, at font size `size`. */
const rowCount = (font, text, size, maxWidth) => {
	const words = text.split(/\s+/).filter(Boolean)
	if (!words.length) return 1
	const space = charWidth(font, ' ') * size
	let rows = 1
	let used = 0
	for (const word of words) {
		const width = textWidth(font, word) * size
		if (used > 0 && used + space + width <= maxWidth) {
			used += space + width
			continue
		}
		if (used > 0) rows++
		// A word wider than the line breaks across rows.
		if (width > maxWidth) {
			rows += Math.ceil(width / maxWidth) - 1
			used = width % maxWidth
		} else {
			used = width
		}
	}
	return rows
}

// Smallest lyric size. Lines that need less than this would be cut off; MAX_LINES and MAX_CHARS keep them far from it.
const MIN_SIZE = 12

/** The largest font size, from `max` down, at which the lines fit in `width` x `height`. Smaller beats cut-off lines. */
export const fitFontSize = ({ style, lines, width, height, max }) => {
	const type = TYPE[style]
	for (let size = max; size > MIN_SIZE; size -= 2) {
		const rows = lines.reduce((sum, line) => sum + rowCount(type.font, line, size, width), 0)
		const total = rows * size * type.lineHeight + (lines.length - 1) * size * type.gap
		if (total <= height) return size
	}
	return MIN_SIZE
}

/** The box the lyrics have in each style, in image pixels. */
export const lyricBox = (style, format, brand) => {
	const f = FORMATS[format]
	if (style === 'glow') {
		return {
			width: f.w - f.padH * 2,
			height: f.h - f.padV * 2 - GLOW.quote - GLOW.above - GLOW.below - GLOW.thumb,
		}
	}
	if (style === 'block') {
		return {
			width: f.w - f.padH * 2,
			height: f.h - f.padV * 2 - BLOCK.top - BLOCK.ruleAbove - BLOCK.rule - BLOCK.ruleBelow - BLOCK.disc - BLOCK.ring * 2,
		}
	}
	const paper = polaroidPaper(format)
	const maxPaper = f.h - f.padV * 2 - (brand ? POLAROID.brand : 0)
	return {
		width: paper.inner,
		height: maxPaper - POLAROID.padTop - POLAROID.padBottom - paper.photo - POLAROID.gap * 2 - POLAROID.sign,
	}
}

export const cardFontSize = (style, format, lines, brand) => {
	const shown = TYPE[style].upper ? lines.map((line) => line.toUpperCase()) : lines
	return fitFontSize({ style, lines: shown, ...lyricBox(style, format, brand), max: FORMATS[format][style] })
}

// ---------- colour ----------

const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

export const rgba = (hex, alpha) => `rgba(${hexRgb(hex).join(',')},${alpha})`

export const mix = (a, b, t) => {
	const A = hexRgb(a)
	const B = hexRgb(b)
	return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

const luminance = (hex) => {
	const [r, g, b] = hexRgb(hex).map((v) => {
		v /= 255
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
	})
	return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Dark or white text, whichever reads better on `hex`. */
export const inkOn = (hex) => (luminance(hex) > 0.36 ? '#141414' : '#ffffff')

const distance = (a, b) => {
	const A = hexRgb(a)
	const B = hexRgb(b)
	return Math.sqrt(A.reduce((sum, v, i) => sum + (v - B[i]) ** 2, 0))
}

/** Up to `count` clearly different colours, keeping their order. */
export const distinctColors = (colors, count = 4) => {
	const out = []
	for (const color of colors) {
		if (!/^#[0-9a-f]{6}$/i.test(color ?? '')) continue
		if (out.some((c) => distance(c, color) < 48)) continue
		out.push(color.toLowerCase())
		if (out.length === count) break
	}
	return out
}
