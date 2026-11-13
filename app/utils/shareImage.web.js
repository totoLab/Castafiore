import html2canvas from 'html2canvas'

/**
 * Draws a view into a PNG of exactly `width` x `height` pixels, as a data URI.
 * react-native-view-shot cannot find the element on web, so html2canvas is called directly.
 */
export const captureImage = async (ref, { width, height }) => {
	const node = ref.current
	if (!node) throw new Error('Nothing to capture.')
	const canvas = await html2canvas(node, {
		backgroundColor: null,
		scale: width / node.offsetWidth,
		logging: false,
	})
	if (canvas.width === width && canvas.height === height) return canvas.toDataURL('image/png')
	const exact = document.createElement('canvas')
	exact.width = width
	exact.height = height
	exact.getContext('2d').drawImage(canvas, 0, 0, width, height)
	return exact.toDataURL('image/png')
}

// A data URI as a Blob, without awaiting anything.
const toBlob = (uri) => {
	const [head, data] = uri.split(',')
	const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0))
	return new Blob([bytes], { type: head.slice(5).split(';')[0] })
}

/**
 * Shares a PNG (a data URI) with the browser's share sheet where it can share files,
 * otherwise downloads it. Resolves to 'shared', 'cancelled' or 'downloaded'.
 * Browsers open the share sheet only straight after a tap, so nothing is awaited before `navigator.share`.
 */
export const shareImage = async (uri, { title, fileName }) => {
	const blob = toBlob(uri)
	const file = new File([blob], fileName, { type: 'image/png' })
	if (navigator.canShare?.({ files: [file] })) {
		try {
			await navigator.share({ files: [file], title })
			return 'shared'
		} catch (error) {
			if (error?.name === 'AbortError') return 'cancelled'
			// Some browsers refuse files after saying they can share them: download instead.
		}
	}
	const url = URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = url
	link.download = fileName
	document.body.appendChild(link)
	link.click()
	link.remove()
	setTimeout(() => URL.revokeObjectURL(url), 10000)
	return 'downloaded'
}
