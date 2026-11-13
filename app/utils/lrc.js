const TIME = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g

// Synced lyrics, sorted by time. A line with several times ("[00:12.00][01:30.00]Chorus") is repeated at each.
export const parseLrc = (lrc) => {
	if (!lrc) return []
	const lyrics = []
	for (const line of lrc.split(/\r?\n/)) {
		const text = line.replace(TIME, '').trim()
		for (const [, minutes, seconds, digits] of line.matchAll(TIME)) {
			// "[00:12.3]", "[00:12.34]" and "[00:12.345]" are all used
			const fraction = digits ? parseInt(digits) / 10 ** digits.length : 0
			lyrics.push({ time: parseInt(minutes) * 60 + parseInt(seconds) + fraction, text })
		}
	}
	return lyrics.sort((a, b) => a.time - b.time)
}

// Lyrics with no timing, one entry per line. `time` is null, so nothing follows playback.
export const parsePlain = (text) => {
	if (!text) return []
	return text.split(/\r?\n/).map((line) => ({ time: null, text: line.trim() }))
}
