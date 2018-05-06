
declare var module: any
declare var require: any
declare var process: any
declare var __dirname: any

const express = require('express')
const formidable = require('formidable')
const os = require('os')
const logger = require('tracer').console()
const fse = require('fs-extra')

import { Meta, Dirs, Bake, Items, Tag, NBake } from 'nbake/lib/Base'

export class MetaAdmin {
	ver() {
		return "v3.05.06"
	}
}

export class FileOps {
	root
	constructor(root_) {
		this.root = root_
	}

	clone(src,dest):string {
		logger.trace('copy?')
		fse.copySync(this.root+'/'+src, this.root+'/'+dest)
		logger.trace('copy!')
		return 'ok'
	}//()
}//FileOps

export class Srv {
	static bake //()
	static itemize// ()
	static prop //ROOT folder, yaml, etc.
	static mount
	app //express

	constructor(bake_, itemize_, prop_) {// functions to call
		Srv.bake = bake_
		Srv.itemize = itemize_
		Srv.prop = prop_
		Srv.mount = prop_.mount

		this.app = express()
		this.app.set('views', __dirname + '/admin_www')

		//upload
		this.app.get('/upload', function (req, res) {
			res.render('upload')
		})
	}

	static ret(res, msg) {
		logger.trace(msg)
		res.send(msg)
	}

	u() {//upload
		const secretProp = 'secret'
		const folderProp = 'folder'
		const SECRET = Srv.prop.secret

		//form
		this.app.post('/upload', function (req, res) {
			logger.trace('upload')

			const form = new formidable.IncomingForm()
			form.keepExtensions = true
			form.multiples = false

			//start upload
			form.parse(req, function(err, fields_, file__) {

				let file = file__.file

				if(err) {
					logger.trace(err)
					res.send( err )
					Srv.removeFile(file)
					return
				}

				let sec =fields_[secretProp]
				if(sec!=SECRET) {
					logger.trace('wrong secret')
					res.status(422).send('wrong secret')
					Srv.removeFile(file)
					return
				}

				let fn = file.name
				logger.trace(fn)

				let folder = fields_[folderProp]
				if(!folder || folder.length<2) {
					logger.trace('no folder')
					res.status(422).send('no folder')
					Srv.removeFile(file)
					return
				}
				folder = Srv.mount + folder +'/'

				logger.trace(folder)

				try {
					fn = folder + fn
					logger.trace(fn)
					fse.moveSync(file.path, fn, { overwrite: true })
				} catch(e) {
					logger.trace(e)
					res.status( 422 ).send( e )
					return
				}

				logger.trace('done')

				//done
				res.status(200)
				res.send( file.name)

			})
		})//post route

	}//()

	static removeFile(f) {
		logger.trace('remove')
		try {
			fse.removeSync(f.path)
		} catch(e) {
			logger.trace(e)
		}
	}//()

	s() {//api
		this.u()

		const secretProp = 'secret'
		const folderProp = 'folder'
		const SECRET = Srv.prop.secret

		const srcProp = 'src'
		const destProp = 'dest'

		this.app.get('/items', function (req, res) {
			let qs = req.query
			let keys = Object.keys( qs )
			logger.trace(JSON.stringify(qs))

			if(!keys.includes(secretProp)) {
				Srv.ret(res, 'no secret')
				return
			}
			let secret = qs.secret
			if(secret != SECRET) {
				Srv.ret(res, 'wrong')
				return
			}

			try {
				let msg = Srv.itemize(qs[folderProp])
				Srv.ret(res, msg)
			} catch(err) {
				Srv.ret(res, err)
			}

		})

		this.app.get('/clone', function (req, res) {
			let qs = req.query
			let keys = Object.keys( qs )
			logger.trace(JSON.stringify(qs))

			if(!keys.includes(secretProp)) {
				Srv.ret(res, 'no secret')
				return
			}
			let secret = qs.secret
			if(secret != SECRET) {
				Srv.ret(res, 'wrong')
				return
			}

			let src = qs[srcProp]
			let dest = qs[destProp]
			let f = new FileOps(Srv.prop.mount)
			let ret = f.clone(src,dest)
			Srv.ret(res, ret)

		})

		this.app.get('/bake', function (req, res) {
			let qs = req.query
			let keys = Object.keys( qs )
			logger.trace(JSON.stringify(qs))

			if(!keys.includes(secretProp)) {
				Srv.ret(res, 'no secret')
				return
			}
			let secret = qs.secret
			if(secret != SECRET) {
				Srv.ret(res, 'wrong')
				return
			}
			if(!keys.includes(folderProp)) {
				Srv.ret(res,'no folder')
				return
			}

			try {
				let msg = Srv.bake(qs[folderProp])
				Srv.ret(res, msg)
			} catch(err) {
				Srv.ret(res, err)
			}

		})// api route

		return this

	}//()

	start() {
		this.app.use(express.static(__dirname + '/www_admin'))

		this.app.listen(Srv.prop.port, function () {
			logger.trace('port '+Srv.prop.port)
		})

	}//()
}//class


module.exports = {
	Srv, FileOps, MetaAdmin
}
