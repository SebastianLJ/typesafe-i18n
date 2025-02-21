// This file was auto-generated by 'typesafe-i18n'. Any manual changes will be overwritten.
/* eslint-disable */
import { BaseTranslation as BaseTranslationType } from 'typesafe-i18n'
import { LocalizedString } from 'typesafe-i18n'

export type BaseTranslation = BaseTranslationType
export type BaseLocale = 'en'

export type Locales =
	| 'en'

export type Translation = {
	/**
	 * Hi {name}, I have {nrOfApples} {{Afpel|Äpfel}}
	 * @param {unknown} name
	 * @param {string | number | boolean} nrOfApples
	 */
	'TEST': string
}

export type TranslationFunctions = {
	/**
	 * Hi {name}, I have {nrOfApples} {{Afpel|Äpfel}}
	 */
	'TEST': (arg: { name: unknown, nrOfApples: string | number | boolean }) => LocalizedString
}

export type Formatters = {}
