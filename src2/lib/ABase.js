"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require('express');
const formidable = require('formidable');
const os = require('os');
const logger = require('tracer').console();
const fse = require('fs-extra');
const fs = require('fs');
const bodyParser = require('body-parser');
class MetaAdmin {
    ver() {
        return "v3.05.06";
    }
}
exports.MetaAdmin = MetaAdmin;
class FileOps {
    constructor(root_) {
        this.root = root_;
    }
    clone(src, dest) {
        logger.trace('copy?');
        fse.copySync(this.root + '/' + src, this.root + '/' + dest);
        logger.trace('copy!');
        return 'ok';
    }
    static hasWhiteSpace(s) {
        return s.indexOf(' ') >= 0;
    }
    read(folder, file) {
        const ext = file.split('.').pop();
        if (!FileOps.READ_VALID.includes(ext))
            return 'other media';
        const full = this.root + folder + file;
        if (!fs.existsSync(full))
            return file + ' does not exists';
        const str = fs.readFileSync(full, 'utf8');
        return str;
    }
    write(folder, file, txt) {
        const ext = file.split('.').pop();
        if (!FileOps.READ_VALID.includes(ext))
            return false;
        if (FileOps.hasWhiteSpace(file))
            return false;
        const full = this.root + folder + file;
        fs.writeFileSync(full, txt, 'utf8');
        return true;
    }
    listFiles(folder) {
        const files = fs.readdirSync(this.root + folder);
        let rows = [];
        for (let i in files) {
            let f = files[i];
            if (FileOps.hasWhiteSpace(f))
                continue;
            let row = new Object();
            row['name'] = f;
            const full = this.root + folder + f;
            const stats = fs.statSync(full);
            row['dir'] = stats.isDirectory();
            row['ext'] = f.split('.').pop();
            rows.push(row);
        }
        return JSON.stringify(rows);
    }
}
FileOps.READ_VALID = ['pug', 'yaml', 'md', 'css', 'txt', 'json', 'html', 'js', 'ts'];
exports.FileOps = FileOps;
class Srv {
    constructor(bake_, itemize_, prop_) {
        Srv.bake = bake_;
        Srv.itemize = itemize_;
        Srv.prop = prop_;
        Srv.mount = prop_.mount;
        this.app = express();
        this.app.set('views', __dirname + '/admin_www');
        this.app.get('/upload', function (req, res) {
            res.render('upload');
        });
    }
    static ret(res, msg) {
        logger.trace(msg);
        res.send(msg);
    }
    uploadSetup() {
        const secretProp = 'secret';
        const folderProp = 'folder';
        const SECRET = Srv.prop.secret;
        this.app.post('/upload', function (req, res) {
            logger.trace('upload');
            const form = new formidable.IncomingForm();
            form.keepExtensions = true;
            form.multiples = false;
            form.parse(req, function (err, fields_, file__) {
                let file = file__.file;
                if (err) {
                    logger.trace(err);
                    res.send(err);
                    Srv.removeFile(file);
                    return;
                }
                let sec = fields_[secretProp];
                if (sec != SECRET) {
                    logger.trace('wrong secret');
                    res.status(422).send('wrong secret');
                    Srv.removeFile(file);
                    return;
                }
                let fn = file.name;
                logger.trace(fn);
                let folder = fields_[folderProp];
                if (!folder || folder.length < 2) {
                    logger.trace('no folder');
                    res.status(422).send('no folder');
                    Srv.removeFile(file);
                    return;
                }
                folder = Srv.mount + folder + '/';
                logger.trace(folder);
                try {
                    fn = folder + fn;
                    logger.trace(fn);
                    fse.moveSync(file.path, fn, { overwrite: true });
                }
                catch (e) {
                    logger.trace(e);
                    res.status(422).send(e);
                    return;
                }
                logger.trace('done');
                res.status(200);
                res.send(file.name);
            });
        });
    }
    static removeFile(f) {
        logger.trace('remove');
        try {
            fse.removeSync(f.path);
        }
        catch (e) {
            logger.trace(e);
        }
    }
    static checkSecret(qs, res) {
        try {
            logger.trace(JSON.stringify(qs));
            let keys = Object.keys(qs);
            if (!keys.includes(Srv.secretProp)) {
                Srv.ret(res, 'no secret');
                return false;
            }
            let secret = qs.secret;
            if (secret != Srv.prop.secret) {
                Srv.ret(res, 'wrong');
                return false;
            }
            return true;
        }
        catch (e) {
            logger.trace(e);
            Srv.ret(res, e);
            return false;
        }
    }
    apiSetup() {
        this.uploadSetup();
        this.app.get('/api/write', function (req, res) {
            let qs = req.query;
            if (!Srv.checkSecret(qs, res))
                return;
            let keys = Object.keys(qs);
            if (!keys.includes(Srv.folderProp)) {
                Srv.ret(res, 'no folder');
                return;
            }
            try {
                const folder = qs[Srv.folderProp];
                const fn = qs['fn'];
                const fo = new FileOps(this.root);
                let txt = req.body.toString();
                logger.trace(txt);
                let msg = fo.write(folder, fn, txt);
                Srv.ret(res, msg);
            }
            catch (err) {
                Srv.ret(res, err);
            }
        });
        this.app.get('/api/read', function (req, res) {
            let qs = req.query;
            if (!Srv.checkSecret(qs, res))
                return;
            let keys = Object.keys(qs);
            if (!keys.includes(Srv.folderProp)) {
                Srv.ret(res, 'no folder');
                return;
            }
            try {
                const folder = qs[Srv.folderProp];
                const fn = qs['fn'];
                const fo = new FileOps(this.root);
                let msg = fo.read(folder, fn);
                Srv.ret(res, msg);
            }
            catch (err) {
                Srv.ret(res, err);
            }
        });
        this.app.get('/api/list', function (req, res) {
            let qs = req.query;
            if (!Srv.checkSecret(qs, res))
                return;
            let keys = Object.keys(qs);
            if (!keys.includes(Srv.folderProp)) {
                Srv.ret(res, 'no folder');
                return;
            }
            try {
                const folder = qs[Srv.folderProp];
                const fo = new FileOps(this.root);
                let msg = fo.listFiles(folder);
                Srv.ret(res, msg);
            }
            catch (err) {
                Srv.ret(res, err);
            }
        });
        this.app.get('/api/items', function (req, res) {
            let qs = req.query;
            if (!Srv.checkSecret(qs, res))
                return;
            let keys = Object.keys(qs);
            if (!keys.includes(Srv.folderProp)) {
                Srv.ret(res, 'no folder');
                return;
            }
            try {
                let msg = Srv.itemize(qs[Srv.folderProp]);
                Srv.ret(res, msg);
            }
            catch (err) {
                Srv.ret(res, err);
            }
        });
        this.app.get('/api/clone', function (req, res) {
            let qs = req.query;
            if (!Srv.checkSecret(qs, res))
                return;
            let keys = Object.keys(qs);
            let src = qs[Srv.srcProp];
            let dest = qs[Srv.destProp];
            let f = new FileOps(Srv.prop.mount);
            let ret = f.clone(src, dest);
            Srv.ret(res, ret);
        });
        this.app.get('/api/bake', function (req, res) {
            let qs = req.query;
            if (!Srv.checkSecret(qs, res))
                return;
            let keys = Object.keys(qs);
            if (!keys.includes(Srv.folderProp)) {
                Srv.ret(res, 'no folder');
                return;
            }
            try {
                let msg = Srv.bake(qs[Srv.folderProp]);
                Srv.ret(res, msg);
            }
            catch (err) {
                Srv.ret(res, err);
            }
        });
        return this;
    }
    static() {
        this.app.use(bodyParser);
        this.app.use(express.static(__dirname + '/www_admin'));
        this.app.listen(Srv.prop.port, function () {
            logger.trace('port ' + Srv.prop.port);
        });
    }
}
Srv.secretProp = 'secret';
Srv.folderProp = 'folder';
Srv.srcProp = 'src';
Srv.destProp = 'dest';
exports.Srv = Srv;
module.exports = {
    Srv, FileOps, MetaAdmin
};
