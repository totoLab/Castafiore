import { useFonts } from 'expo-font'
import { Anton_400Regular } from '@expo-google-fonts/anton/400Regular'
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold'
import { CourierPrime_400Regular } from '@expo-google-fonts/courier-prime/400Regular'
import { CourierPrime_400Regular_Italic } from '@expo-google-fonts/courier-prime/400Regular_Italic'

// The lyric cards' typefaces, all under the SIL Open Font License. Each is one weight, so no fontWeight is set with them.
export const FONT = {
	display: 'LyricsDisplay',
	block: 'LyricsBlock',
	typed: 'LyricsTyped',
	typedItalic: 'LyricsTypedItalic',
}

/** True once the fonts are loaded, or failed to load (the cards then use the system font). */
export const useCardFonts = () => {
	const [loaded, error] = useFonts({
		[FONT.display]: BricolageGrotesque_700Bold,
		[FONT.block]: Anton_400Regular,
		[FONT.typed]: CourierPrime_400Regular,
		[FONT.typedItalic]: CourierPrime_400Regular_Italic,
	})
	return loaded || !!error
}
