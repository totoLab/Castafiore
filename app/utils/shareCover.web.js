import React from 'react'

import logger from '~/utils/logger'
import { urlCover } from '~/utils/url'

/**
 * The cover for a lyric card, as data URIs. The web capture draws the page into a canvas, and an image
 * from another server would block the export; a data URI also keeps the server login out of the page.
 * The capture cannot draw CSS blur, so the backdrop is blurred here, by shrinking the cover and
 * scaling it back up in steps.
 */

const toDataUri = (blob) => new Promise((resolve, reject) => {
	const reader = new FileReader()
	reader.onload = () => resolve(reader.result)
	reader.onerror = reject
	reader.readAsDataURL(blob)
})

const loadImage = (src) => new Promise((resolve, reject) => {
	const img = new window.Image()
	img.onload = () => resolve(img)
	img.onerror = reject
	img.src = src
})

const blurred = async (src) => {
	const img = await loadImage(src)
	let canvas = document.createElement('canvas')
	canvas.width = canvas.height = 16
	let ctx = canvas.getContext('2d')
	ctx.imageSmoothingQuality = 'high'
	ctx.drawImage(img, 0, 0, 16, 16)
	for (const side of [32, 64, 128, 256]) {
		const next = document.createElement('canvas')
		next.width = next.height = side
		const nextCtx = next.getContext('2d')
		nextCtx.imageSmoothingQuality = 'high'
		nextCtx.drawImage(canvas, 0, 0, side, side)
		canvas = next
		ctx = nextCtx
	}
	return canvas.toDataURL('image/jpeg', 0.9)
}

const useShareCover = (config, song) => {
	const [state, setState] = React.useState({ cover: null, backdrop: null, colorSource: null, ready: false })

	React.useEffect(() => {
		const url = song ? urlCover(config, song, 600) : null
		if (!url) {
			setState({ cover: null, backdrop: null, colorSource: null, ready: true })
			return
		}
		let active = true
		setState({ cover: null, backdrop: null, colorSource: null, ready: false })
		fetch(url)
			.then((res) => {
				if (!res.ok) throw new Error(`cover ${res.status}`)
				return res.blob()
			})
			.then(toDataUri)
			.then(async (cover) => {
				const backdrop = await blurred(cover).catch(() => cover)
				if (active) setState({ cover, backdrop, colorSource: cover, ready: true })
			})
			.catch((error) => {
				logger.error('shareCover', `${error}`)
				if (active) setState({ cover: null, backdrop: null, colorSource: null, ready: true })
			})
		return () => { active = false }
	}, [config?.url, song?.id])

	return state
}

export default useShareCover
