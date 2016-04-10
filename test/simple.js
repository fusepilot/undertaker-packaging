import { expect } from 'chai'
import { join } from 'path'
import fs from 'fs'
import { promisify } from 'bluebird'
import Undertaker from 'undertaker'
import PackagingRegistery from '../src'

const config = {
  path: join(__dirname, 'simple', 'src'),
  templateValues: { title: 'Simple' },
  id: 'com.simple',
  title: 'Simple',
  version: '1.0.0',
  installPath: '/fake/install/path',
  outputPath: join(__dirname, 'simple', 'bin'),
}

describe('simple', function() {
  before(function() {
    this.taker = new Undertaker()
    this.registry = new PackagingRegistery(config)
  })

  after(async function() {
    await promisify(this.taker.series('packaging:clean:output'))()
  })

  it('adds tasks', function() {
    this.taker.registry(this.registry)
    const tasks = this.taker.tree().nodes

    expect(tasks).to.include('packaging')
    expect(tasks).to.include('packaging:build')
    expect(tasks).to.include('packaging:resources')
    expect(tasks).to.include('packaging:resources:markdown')
    expect(tasks).to.include('packaging:resources:html')
    expect(tasks).to.include('packaging:resources:images')
    expect(tasks).to.include('packaging:distribution')
    expect(tasks).to.include('packaging:scripts')
    expect(tasks).to.include('packaging:bundle')
    expect(tasks).to.include('packaging:sign')
    expect(tasks).to.include('packaging:copy')
    expect(tasks).to.include('packaging:clean')
    expect(tasks).to.include('packaging:signed')
  })

  it('loads config correctly', function() {
    expect(this.registry.config.path).to.equal(join(__dirname, 'simple', 'src'))
    expect(this.registry.config.installPath).to.equal('/fake/install/path')
    expect(this.registry.config.outputPath).to.equal(join(__dirname, 'simple', 'bin'))
  })

  it('creates package', async function() {
    await promisify(this.taker.series('packaging'))()

    expect(() => {
      fs.statSync(join(__dirname, 'simple', 'bin', `${config.title}-${config.version}.pkg`))
    }).to.not.throw(Error)
  })
})
