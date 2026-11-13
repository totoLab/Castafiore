import * as Sharing from 'expo-sharing'
import { captureRef } from 'react-native-view-shot'

/** Draws a view into a PNG file of exactly `width` x `height` pixels. Resolves to its file URI. */
export const captureImage = (ref, { width, height }) => captureRef(ref, {
	format: 'png',
	quality: 1,
	width,
	height,
	result: 'tmpfile',
})

/** Opens the share sheet with a PNG file. Resolves to 'shared' once the sheet closes. */
export const shareImage = async (uri, { title }) => {
	if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.')
	await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: title })
	return 'shared'
}
