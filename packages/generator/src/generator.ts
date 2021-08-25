import { watch } from 'chokidar'
import { resolve, sep } from 'path'
import { isTruthy } from 'typesafe-utils'
import * as ts from 'typescript'
import type { BaseTranslation } from '../../core/src/core'
import {
	containsFolders,
	copyFile,
	createPathIfNotExits,
	deleteFolderRecursive,
	doesPathExist,
	getDirectoryStructure,
	getFiles,
	importFile
} from './file-utils'
import { generate, GeneratorConfig, GeneratorConfigWithDefaultValues, getConfigWithDefaultValues, readConfig } from './generate-files'
import { logger, parseTypescriptVersion, TypescriptVersion } from './generator-util'
import { configureOutputHandler, fileEnding, shouldGenerateJsDoc } from './output-handler'

const getAllLanguages = async (path: string) => {
	const files = await getFiles(path, 1)
	return files.filter(({ folder, name }) => folder && name === `index${fileEnding}`).map(({ folder }) => folder)
}


/**
 * looks for the location of the compiled 'index.js' file
 * if the 'index.ts' file imports something from outside it's directory, we need to find the correct path to the base location file
 */
const detectLocationOfCompiledBaseTranslation = async (outputPath: string, locale: string, tempPath: string): Promise<string> => {
	if (!containsFolders(tempPath)) return ''

	const directory = await getDirectoryStructure(tempPath)

	// contains the path from <root> to base locale file
	const outputPathParts = resolve(outputPath, locale).replace(resolve(), '').split(sep).filter(isTruthy)

	for (let i = 0; i < outputPathParts.length; i++) {
		const part = outputPathParts[i] as string
		const subDirectory = directory[part] as Record<string, unknown> | undefined
		if (subDirectory) {
			let outputPathPartsRest = [...outputPathParts].slice(i + 1)

			let isPathValid = true
			let subDirectoryOfCurrentSection = subDirectory
			const subPaths = [part]
			while (isPathValid && outputPathPartsRest.length) {
				// we need to find the full matching path
				// e.g. `src/path/i18n/en` is invalid if the base locale is located inside `src/i18n/en`
				const subSubDirectoryOfCurrentSection = subDirectoryOfCurrentSection[outputPathPartsRest[0] as string] as Record<string, unknown>
				if (subSubDirectoryOfCurrentSection) {
					subPaths.push(outputPathPartsRest[0] as string)
					outputPathPartsRest = outputPathPartsRest.slice(1)
					subDirectoryOfCurrentSection = subSubDirectoryOfCurrentSection
				} else {
					isPathValid = false
				}
			}

			if (isPathValid) {
				i += outputPathPartsRest.length
				return [...subPaths, ''].join('/')
			}
		}
	}

	return ''
}

const transpileTypescriptAndPrepareImportFile = async (outputPath: string, languageFilePath: string, locale: string, tempPath: string): Promise<string> => {
	const program = ts.createProgram([languageFilePath], { outDir: tempPath })
	program.emit()

	const baseTranslationPath = await detectLocationOfCompiledBaseTranslation(outputPath, locale, tempPath)

	const compiledPath = resolve(tempPath, `${baseTranslationPath}index.js`)
	const copyPath = resolve(tempPath, `${baseTranslationPath}i18n-temp-${debounceCounter}.js`)

	const copySuccess = await copyFile(compiledPath, copyPath, false)
	if (!copySuccess) {
		logger.error(
			`Make sure to give your base locale's default export the type of 'BaseTranslation' and to name the file 'index.ts'.
See https://github.com/ivanhofer/typesafe-i18n#folder-structure for more info`,
		)
		return ''
	}

	return copyPath
}

const parseLanguageFile = async (
	outputPath: string,
	locale: string,
	tempPath: string,
): Promise<BaseTranslation | null> => {
	const originalPath = resolve(outputPath, locale, `index${fileEnding}`)

	if (!(await doesPathExist(originalPath))) {
		logger.info(`could not load base locale file '${locale}'`)
		return null
	}

	!shouldGenerateJsDoc && await createPathIfNotExits(tempPath)

	const importPath = shouldGenerateJsDoc
		? originalPath
		: await transpileTypescriptAndPrepareImportFile(outputPath, originalPath, locale, tempPath)

	if (!importPath) {
		return null
	}

	const languageImport = await importFile<BaseTranslation>(importPath)

	!shouldGenerateJsDoc && await deleteFolderRecursive(tempPath)

	if (!languageImport) {
		logger.error(`could not read default export from language file '${locale}'`)
		return null
	}

	return languageImport
}

let first = true

const parseAndGenerate = async (config: GeneratorConfigWithDefaultValues, version: TypescriptVersion) => {
	if (first) {
		first = false
	} else {
		logger.info('files were modified => looking for changes ...')
	}

	const { baseLocale: locale, tempPath, outputPath } = config

	const locales = await getAllLanguages(outputPath)

	const languageFile =
		(locale && (await parseLanguageFile(outputPath, locale, tempPath))) || {}

	await generate(languageFile, { ...config, baseLocale: locale, locales }, version, logger)

	logger.info('... all files are up to date')
}

let debounceCounter = 0

const debounce = (callback: () => void) =>
	setTimeout(
		(i) => {
			i === debounceCounter && callback()
		},
		100,
		++debounceCounter,
	)

export const startGenerator = async (config?: GeneratorConfig, watchFiles = true): Promise<void> => {
	const configWithDefaultValues = await getConfigWithDefaultValues(config)
	const { outputPath } = configWithDefaultValues

	const version = parseTypescriptVersion(ts.versionMajorMinor)
	configureOutputHandler(configWithDefaultValues, version)

	const onChange = parseAndGenerate.bind(null, configWithDefaultValues, version)

	await createPathIfNotExits(outputPath)

	watchFiles && watch(outputPath).on('all', () => debounce(onChange))

	logger.info(`generating files for ${shouldGenerateJsDoc
		? 'JavaScript with JSDoc notation'
		: `TypeScript version: '${ts.versionMajorMinor}.x'`}`
	)
	logger.info(`options:`, await readConfig(config))
	watchFiles && logger.info(`watcher started in: '${outputPath}'`)

	if (!watchFiles) {
		await onChange()
		logger.info(`generating files completed`)
	}
}
