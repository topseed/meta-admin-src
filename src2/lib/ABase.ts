
declare var module: any
declare var require: any
declare var process: any
declare var __dirname: any

const express = require('express')
const formidable = require('formidable')
const os = require('os')
const logger = require('tracer').console()
const fse = require('fs-extra')
const fs = require('fs')


import { Meta, Dirs, Bake, Items, Tag, NBake } from 'nbake/lib/Base'
import { objectTypeAnnotation } from 'babel-types';

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

	clone(src, dest):string {
		logger.trace('copy?')
		fse.copySync(this.root+'/'+src, this.root+'/'+dest)
		logger.trace('copy!')
		return 'ok'
	}//()

	static hasWhiteSpace(s) {
		return s.indexOf(' ') >= 0;
	 }

	listFiles(folder):string {
		const files = fs.readdirSync(this.root+folder)
		let rows = []
		for (let i in files) {
			let f:string = files[i]
			if(FileOps.hasWhiteSpace(f))
				continue
			let row = new Object()
			row['name'] = f
			const full = this.root+folder + f
			const stats = fs.statSync(full)
			row['dir']= stats.isDirectory()
			row['ext']= f.split('.').pop()
			rows.push(row)
		}// outer

		return JSON.stringify(rows)
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

	uploadSetup() {//upload
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

	static checkSecret(qs, res):boolean {
		logger.trace('remove')
		try {
			logger.trace(JSON.stringify(qs))
			let keys = Object.keys( qs )
			if(!keys.includes(Srv.secretProp)) {
				Srv.ret(res, 'no secret')
				return false
			}
			let secret = qs.secret
			if(secret != Srv.prop.secret) {
				Srv.ret(res, 'wrong')
				return false
			}
			return true
		} catch(e) {
			logger.trace(e)
			Srv.ret(res, e)
			return false
		}
	}//()

	static secretProp = 'secret'
	static folderProp = 'folder'

	static srcProp = 'src'
	static destProp = 'dest'

	apiSetup() {//api
		this.uploadSetup()

		this.app.get('/api/list', function (req, res) {
			let qs = req.query
			if(!Srv.checkSecret(qs,res))
				return;
			let keys = Object.keys( qs )
			if(!keys.includes(Srv.folderProp)) {
				Srv.ret(res,'no folder')
				return
			}

			try {
				let msg = Srv.itemize(qs[Srv.folderProp])
				Srv.ret(res, msg)
			} catch(err) {
				Srv.ret(res, err)
			}
		})//

		this.app.get('/api/items', function (req, res) {
			let qs = req.query
			if(!Srv.checkSecret(qs,res))
				return;
			let keys = Object.keys( qs )
			if(!keys.includes(Srv.folderProp)) {
				Srv.ret(res,'no folder')
				return
			}

			try {
				let msg = Srv.itemize(qs[Srv.folderProp])
				Srv.ret(res, msg)
			} catch(err) {
				Srv.ret(res, err)
			}
		})//

		this.app.get('/api/clone', function (req, res) {
			let qs = req.query
			if(!Srv.checkSecret(qs,res))
				return;
			let keys = Object.keys( qs )

			let src = qs[Srv.srcProp]
			let dest = qs[Srv.destProp]
			let f = new FileOps(Srv.prop.mount)
			let ret = f.clone(src,dest)
			Srv.ret(res, ret)
		})//

		this.app.get('/api/bake', function (req, res) {
			let qs = req.query
			if(!Srv.checkSecret(qs,res))
				return;
			let keys = Object.keys( qs )
			if(!keys.includes(Srv.folderProp)) {
				Srv.ret(res,'no folder')
				return
			}

			try {
				let msg = Srv.bake(qs[Srv.folderProp])
				Srv.ret(res, msg)
			} catch(err) {
				Srv.ret(res, err)
			}
		})//

		return this
	}//()

	static() {
		this.app.use(express.static(__dirname + '/www_admin'))

		this.app.listen(Srv.prop.port, function () {
			logger.trace('port '+Srv.prop.port)
		})

	}//()
}//class


module.exports = {
	Srv, FileOps, MetaAdmin
}
