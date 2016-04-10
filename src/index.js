import { sep, join } from 'path'
import mustache from 'gulp-mustache'
import pandoc from 'gulp-pandoc'
import rename from 'gulp-rename'
import del from 'del'
import vfs from 'vinyl-fs'
import { exec } from 'child_process'
import os from 'os'
import DefaultRegistery from 'undertaker-registry'

export default class PackagingRegistery extends DefaultRegistery {
  constructor({title, id, version, path, scriptsPath, installPath, templateValues, resourcesPath, tempPath, outputPath}={}) {
    super()

    if (!title) throw(`[PackagingRegistery] Required parameter "title" was not provided to PackagingRegistery`)
    if (!id) throw(`[PackagingRegistery] Required parameter "id" was not provided to PackagingRegistery`)
    if (!version) throw(`[PackagingRegistery] Required parameter "version" was not provided to PackagingRegistery`)
    if (!path) throw(`[PackagingRegistery] Required parameter "path" was not provided to PackagingRegistery`)
    if (!installPath) throw(`[PackagingRegistery] Required parameter "installPath" was not provided to PackagingRegistery`)

    this.config = {
      path,
      title,
      id,
      version,
      path,
      templateValues,
      installPath,
      scriptsPath,
      resourcesPath: resourcesPath || join(path, 'resources'),
      outputPath: outputPath || join(path, 'bin'),
      tempPath: tempPath || join(os.tmpdir(), id),
    }
  }

  init(taker) {
    taker.task('packaging:resources:markdown', () => {
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

    taker.task('packaging:resources:html', () => {
      return vfs.src(join(this.config.resourcesPath, '*.html'))
        .pipe(mustache({...this.config.templateValues, ...this.config}))
        .pipe(vfs.dest(join(this.config.tempPath, 'resources')))
    })

    taker.task('packaging:resources:images', () => {
      return vfs.src(join(this.config.resourcesPath, '*.png'))
        .pipe(vfs.dest(join(this.config.tempPath, 'resources')))
    })

    taker.task('packaging:resources', taker.parallel('packaging:resources:html', 'packaging:resources:images', 'packaging:resources:markdown'))

    taker.task('packaging:build', (cb) => {
      exec(`
        mkdir -p ${join(this.config.tempPath, 'packages')} \
        && mkdir -p ${join(this.config.tempPath, 'scripts')} \
        && pkgbuild --root ${this.config.path} \
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

    taker.task('packaging:distribution', (cb) => {
      return vfs.src(join(__dirname, 'distribution.xml.mustache'))
        .pipe(mustache(this.config.templateValues))
        .pipe(rename(`distribution.xml`))
        .pipe(vfs.dest(this.config.tempPath))
    })

    taker.task('packaging:scripts', (cb) => {
      return vfs.src(join(this.config.scriptsPath, '*'))
        .pipe(mustache({...this.config.templateValues, ...this.config}))
        .pipe(vfs.dest(join(this.config.tempPath, 'scripts')))
    })

    taker.task('packaging:bundle', (cb) => {
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

    taker.task('packaging:sign', (cb) => {
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

    taker.task('packaging:copy', (cb) => {
      return vfs.src(join(this.config.tempPath, `${this.config.title}-${this.config.version}.pkg`))
        .pipe(vfs.dest(this.config.outputPath))
    })

    taker.task('packaging:clean', () => {
      return del([join(this.config.tempPath)], { force: true })
    })

    taker.task('packaging:clean:output', () => {
      return del([join(this.config.outputPath)], { force: true })
    })

    taker.task('packaging', taker.series('packaging:clean', taker.parallel('packaging:distribution'), 'packaging:resources', 'packaging:build', 'packaging:bundle', 'packaging:copy', 'packaging:clean'))
    taker.task('packaging:signed', taker.series('packaging:clean', taker.parallel('packaging:distribution'), 'packaging:resources', 'packaging:build', 'packaging:bundle', 'packaging:sign', 'packaging:clean'))
  }
}
