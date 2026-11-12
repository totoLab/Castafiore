const TIME = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/

export const parseLrc = (lrc) => {
	if (!lrc) return []
	const lines = lrc.split(/\r?\n/)
	const lyrics = []
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		const time = line.match(TIME)
		if (time) {
			const minutes = parseInt(time[1])
			const seconds = parseInt(time[2])
			// "[00:12.3]", "[00:12.34]" and "[00:12.345]" are all used
			const fraction = time[3] ? parseInt(time[3]) / 10 ** time[3].length : 0
			const text = line.replace(new RegExp(TIME, 'g'), '').trim()
			lyrics.push({
				time: minutes * 60 + seconds + fraction,
				text
			})
		}
	}
	return lyrics
}

// Lyrics with no timing, one entry per line. `time` is null, so nothing follows playback.
export const parsePlain = (text) => {
	if (!text) return []
	return text.split(/\r?\n/).map((line) => ({ time: null, text: line.trim() }))
}
