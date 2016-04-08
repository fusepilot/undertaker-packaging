import { sep, join } from 'path'

import mustache from 'gulp-mustache'
import pandoc from 'gulp-pandoc'
import rename from 'gulp-rename'
import del from 'del'
import vfs from 'vinyl-fs'
import { exec } from 'child_process'
import DefaultRegistery from 'undertaker-registry'

export default class PackageRegistery extends DefaultRegistery {
  constructor({title, id, version, path, sourcePath, installPath, templateValues, resourcesPath, tempPath, outputPath}={}) {
    super()

    if (!title) throw(`[PackageRegistery] Required parameter "title" was not provided to PackageRegistery`)
    if (!id) throw(`[PackageRegistery] Required parameter "id" was not provided to PackageRegistery`)
    if (!version) throw(`[PackageRegistery] Required parameter "version" was not provided to PackageRegistery`)
    if (!sourcePath) throw(`[PackageRegistery] Required parameter "sourcePath" was not provided to PackageRegistery`)
    if (!installPath) throw(`[PackageRegistery] Required parameter "installPath" was not provided to PackageRegistery`)

    this.config = {
      path: path || process.cwd(),
      title,
      id,
      version,
      sourcePath,
      templateValues,
      installPath,
      resourcesPath: resourcesPath || join(path || process.cwd(), 'resources'),
      outputPath: outputPath || join(path || process.cwd(), 'bin'),
      tempPath: tempPath || join(path || process.cwd(), 'tmp'),
    }
  }

  init(taker) {
    taker.task('pkg:resources:markdown', () => {
      return vfs.src(join(this.config.resourcesPath, '*.md'))
        .pipe(mustache({...this.config.templateValues, ...this.config}))
        .pipe(pandoc({
          from: 'markdown',
          to: 'rtf',
          ext: '.rtf',
          args: ['--standalone'],
        }))
        .pipe(vfs.dest(join(this.config.tempPath, 'resources')))
    })

    taker.task('pkg:resources:html', () => {
      return vfs.src(join(this.config.resourcesPath, '*.html'))
        .pipe(mustache({...this.config.templateValues, ...this.config}))
        .pipe(vfs.dest(join(this.config.tempPath, 'resources')))
    })

    taker.task('pkg:resources:images', () => {
      return vfs.src(join(this.config.resourcesPath, '*.png'))
        .pipe(vfs.dest(join(this.config.tempPath, 'resources')))
    })

    taker.task('pkg:resources', taker.parallel('pkg:resources:html', 'pkg:resources:images', 'pkg:resources:markdown'))

    // --scripts ${join(this.config.tempPath, 'scripts')} \
    taker.task('pkg:build', (cb) => {
      exec(`
        mkdir -p ${this.config.tempPath}/packages \
        && pkgbuild --root ${this.config.sourcePath} \
          --scripts ${join(this.config.tempPath, 'scripts')} \
          --identifier ${this.config.bundleName} \
          --version ${this.config.version} \
          --install-location ${this.config.installPath} \
          ${join(this.config.tempPath, 'packages', this.config.title)}.pkg
      `, (err) => {
        if (err) console.error(err)
        cb()
      })
    })

    taker.task('pkg:distribution', (cb) => {
      return vfs.src(join(__dirname, 'lib', 'distribution.xml.mustache'))
        .pipe(mustache(this.config.templateValues))
        .pipe(rename(`distribution.xml`))
        .pipe(vfs.dest(this.config.tempPath))
    })

    taker.task('pkg:scripts', (cb) => {
      return vfs.src(join(__dirname, 'lib', 'scripts', '*'))
        .pipe(mustache({...this.config.templateValues, ...this.config}))
        // .pipe(rename(`distribution.xml`))
        .pipe(vfs.dest(join(this.config.tempPath, 'scripts')))
    })

    taker.task('pkg:bundle', (cb) => {
      exec(`
        mkdir -p ${this.config.outputPath} && \
        productbuild --distribution ${this.config.tempPath}/distribution.xml \
          --resources ${join(this.config.tempPath, 'resources')} \
          --package-path ${join(this.config.tempPath, 'packages')} \
          ${this.config.tempPath}/${this.config.title}-${this.config.version}.pkg
      `, (err) => {
        if (err) console.error(err.message)
        cb()
      })
    })

    taker.task('pkg:sign', (cb) => {
      exec(`
        security unlock-keychain Fusepilot.keychain \
        && productsign --sign "Fusepilot" \
          --keychain Fusepilot.keychain \
          ${this.config.tempPath}/${this.config.title}-${this.config.version}.pkg ${this.config.outputPath}/${this.config.title}-${this.config.version}.pkg \
      `, (err) => {
        if (err) console.error(err.message)
        cb()
      })
    })

    taker.task('pkg:copy', (cb) => {
      return vfs.src(join(this.config.tempPath, `${this.config.title}-${this.config.version}.pkg`))
        .pipe(vfs.dest(this.config.outputPath))
    })

    taker.task('pkg:clean', () => {
      return del([join(this.config.tempPath)], { force: true })
    })

    taker.task('pkg', taker.series('pkg:clean', taker.parallel('pkg:scripts', 'pkg:distribution'), 'pkg:resources', 'pkg:build', 'pkg:bundle', 'pkg:copy'))
    taker.task('pkg:signed', taker.series('pkg:clean', taker.parallel('pkg:scripts', 'pkg:distribution'), 'pkg:resources', 'pkg:build', 'pkg:bundle', 'pkg:sign'))
  }
}
