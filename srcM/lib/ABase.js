"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require('express');
const formidable = require('formidable');
const os = require('os');
const logger = require('tracer').console();
const fse = require('fs-extra');
const fs = require('fs');
const bodyParser = require('body-parser');
const httpreq = require('httpreq');
const AdmZip = require('adm-zip');
class MetaAdmin {
    ver() {
        return "v3.05.21";
    }
}
exports.MetaAdmin = MetaAdmin;
class FileOps {
    constructor(root_) {
        this.root = root_;
    }
    downloadZip(folder, url, cb) {
        let pos = url.lastIndexOf('/');
        let fn = url.substring(pos);
        const full = this.root + folder;
        logger.trace(full);
        logger.trace(url);
        var options = {
            timeout: 40 * 1000,
            binary: true
        };
        httpreq.get(url, options, function (errf, res) {
            if (errf)
                throw errf;
            logger.trace(res.statusCode);
            fs.writeFile(full + '/' + fn, res.body, function (errw) {
                if (errw)
                    throw errw;
                logger.trace('downloaded');
                FileOps._unzip(full, fn);
                cb();
            });
        });
    }
    static _unzip(full, fn) {
        logger.trace(full + fn);
        let zip = new AdmZip(full + fn);
        zip.extractAllTo(full, true);
        fs.unlinkSync(full + fn);
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
        const full = this.root + folder + '/' + file;
        logger.trace(full);
        if (!fs.existsSync(full))
            return file + ' does not exists';
        const str = fs.readFileSync(full, 'utf8');
        return str;
    }
    autoBake(res, folder, file) {
        const full = this.root + folder + '/' + file;
        logger.trace(full);
        const ext = file.split('.').pop();
        if (ext == 'pug') {
            if (file.indexOf('-tag') >= 0) {
                try {
                    let msg = SrvUtil.tags(folder);
                    SrvUtil.ret(res, msg);
                }
                catch (err) {
                    SrvUtil.ret(res, err);
                }
                return 'tag';
            }
            try {
                let msg = SrvUtil.bake(folder);
                SrvUtil.ret(res, msg);
            }
            catch (err) {
                SrvUtil.ret(res, err);
            }
            return 'pug';
        }
        if (ext == 'yaml') {
            try {
                let msg = SrvUtil.bake(folder);
                msg += SrvUtil.itemize(folder);
                SrvUtil.ret(res, msg);
            }
            catch (err) {
                SrvUtil.ret(res, err);
            }
            return 'yaml';
        }
        return 'nothing to bake';
    }
    write(folder, file, txt) {
        const ext = file.split('.').pop();
        if (!FileOps.READ_VALID.includes(ext))
            return false;
        if (FileOps.hasWhiteSpace(file))
            return false;
        const full = this.root + folder + '/' + file;
        logger.trace(full);
        fs.writeFileSync(full, txt, 'utf8');
        return true;
    }
    listFiles(folder) {
        logger.trace(this.root + folder);
        try {
            const files = fs.readdirSync(this.root + folder);
            let rows = [];
            for (let i in files) {
                let f = files[i];
                if (FileOps.hasWhiteSpace(f))
                    continue;
                let row = [];
                row.push(f);
                const full = this.root + folder + '/' + f;
                const stats = fs.statSync(full);
                row.push(f.split('.').pop());
                row.push(stats.isDirectory());
                rows.push(row);
            }
            return JSON.stringify(rows);
        }
        catch (err) {
            logger.warn(err);
            return JSON.stringify({ 'error': 'bad folder' });
        }
    }
}
FileOps.READ_VALID = ['pug', 'yaml', 'md', 'css', 'txt', 'json', 'html', 'js', 'ts'];
exports.FileOps = FileOps;
class SrvUtil {
    static ret(res, msg) {
        res.send(msg);
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
            if (!keys.includes(SrvUtil.secretProp)) {
                SrvUtil.ret(res, 'no secret');
                return false;
            }
            let secret = qs.secret;
            if (secret != SrvUtil.prop.secret) {
                SrvUtil.ret(res, 'wrong');
                return false;
            }
            return true;
        }
        catch (e) {
            logger.trace(e);
            SrvUtil.ret(res, e);
            return false;
        }
    }
}
SrvUtil.secretProp = 'secret';
SrvUtil.folderProp = 'folder';
SrvUtil.srcProp = 'src';
SrvUtil.destProp = 'dest';
class Srv {
    constructor(bake_, itemize_, tags_, prop_) {
        SrvUtil.tags = tags_;
        SrvUtil.bake = bake_;
        SrvUtil.itemize = itemize_;
        SrvUtil.prop = prop_;
        SrvUtil.mount = prop_.mount;
        SrvUtil.app = express();
        SrvUtil.WWW = prop_.srv_www;
        logger.trace(SrvUtil.WWW);
        SrvUtil.app.set('views', SrvUtil.WWW);
        SrvUtil.app.get('/upload', function (req, res) {
            res.render('upload');
        });
    }
    uploadSetup() {
        const secretProp = 'secret';
        const folderProp = 'folder';
        const SECRET = SrvUtil.prop.secret;
        SrvUtil.app.post('/upload', function (req, res) {
            logger.trace('upload');
            const form = new formidable.IncomingForm();
            form.keepExtensions = true;
            form.multiples = false;
            form.parse(req, function (err, fields_, file__) {
                let file = file__.file;
                if (err) {
                    logger.trace(err);
                    res.send(err);
                    SrvUtil.removeFile(file);
                    return;
                }
                let sec = fields_[secretProp];
                if (sec != SECRET) {
                    logger.trace('wrong secret');
                    res.status(422).send('wrong secret');
                    SrvUtil.removeFile(file);
                    return;
                }
                let fn = file.name;
                logger.trace(fn);
                let folder = fields_[folderProp];
                if (!folder || folder.length < 2) {
                    logger.trace('no folder');
                    res.status(422).send('no folder');
                    SrvUtil.removeFile(file);
                    return;
                }
                folder = SrvUtil.mount + folder + '/';
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
    apiSetup() {
        this.uploadSetup();
        SrvUtil.app.use(bodyParser.text());
        SrvUtil.app.post('/api/write', function (req, res) {
            let qs = req.query;
            if (!SrvUtil.checkSecret(qs, res))
                return;
            let keys = Object.keys(qs);
            if (!keys.includes(SrvUtil.folderProp)) {
                SrvUtil.ret(res, 'no folder');
                return;
            }
            try {
                let folder = qs[SrvUtil.folderProp];
                const fn = qs['fn'];
                const fo = new FileOps(SrvUtil.mount);
                let txt = req.body;
                let msg = fo.write(folder, fn, txt);
                fo.autoBake(res, folder, fn);
            }
            catch (err) {
                SrvUtil.ret(res, err);
            }
        });
        SrvUtil.app.get('/api/downloadZip', function (req, res) {
            let qs = req.query;
            if (!SrvUtil.checkSecret(qs, res))
                return;
            let keys = Object.keys(qs);
            if (!keys.includes(SrvUtil.folderProp)) {
                SrvUtil.ret(res, 'no folder');
                return;
            }
            try {
                let url = qs['url'];
                logger.trace(url);
                const fo = new FileOps(SrvUtil.mount);
                fo.downloadZip(qs[SrvUtil.folderProp], url, function () {
                    SrvUtil.ret(res, 'done');
                });
            }
            catch (err) {
                SrvUtil.ret(res, err);
            }
        });
        SrvUtil.app.get('/api/read', function (req, res) {
            let qs = req.query;
            if (!SrvUtil.checkSecret(qs, res))
                return;
            let keys = Object.keys(qs);
            if (!keys.includes(SrvUtil.folderProp)) {
                SrvUtil.ret(res, 'no folder');
                return;
            }
            try {
                let folder = qs[SrvUtil.folderProp];
                const fn = qs['fn'];
                const fo = new FileOps(SrvUtil.mount);
                let msg = fo.read(folder, fn);
                SrvUtil.ret(res, msg);
            }
            catch (err) {
                SrvUtil.ret(res, err);
            }
        });
        SrvUtil.app.get('/api/list', function (req, res) {
            let qs = req.query;
            if (!SrvUtil.checkSecret(qs, res))
                return;
            let keys = Object.keys(qs);
            if (!keys.includes(SrvUtil.folderProp)) {
                SrvUtil.ret(res, 'no folder');
                return;
            }
            try {
                let folder = qs[SrvUtil.folderProp];
                const fo = new FileOps(SrvUtil.mount);
                let msg = fo.listFiles(folder);
                SrvUtil.ret(res, msg);
            }
            catch (err) {
                SrvUtil.ret(res, err);
            }
        });
        SrvUtil.app.get('/api/items', function (req, res) {
            let qs = req.query;
            if (!SrvUtil.checkSecret(qs, res))
                return;
            let keys = Object.keys(qs);
            if (!keys.includes(SrvUtil.folderProp)) {
                SrvUtil.ret(res, 'no folder');
                return;
            }
            try {
                let msg = SrvUtil.itemize(qs[SrvUtil.folderProp]);
                SrvUtil.ret(res, msg);
            }
            catch (err) {
                SrvUtil.ret(res, err);
            }
        });
        SrvUtil.app.get('/api/tags', function (req, res) {
            let qs = req.query;
            if (!SrvUtil.checkSecret(qs, res))
                return;
            let keys = Object.keys(qs);
            if (!keys.includes(SrvUtil.folderProp)) {
                SrvUtil.ret(res, 'no folder');
                return;
            }
            try {
                let msg = SrvUtil.tags(qs[SrvUtil.folderProp]);
                SrvUtil.ret(res, msg);
            }
            catch (err) {
                SrvUtil.ret(res, err);
            }
        });
        SrvUtil.app.get('/api/clone', function (req, res) {
            let qs = req.query;
            if (!SrvUtil.checkSecret(qs, res))
                return;
            let keys = Object.keys(qs);
            let src = qs[SrvUtil.srcProp];
            let dest = qs[SrvUtil.destProp];
            let f = new FileOps(SrvUtil.prop.mount);
            let ret = f.clone(src, dest);
            SrvUtil.ret(res, ret);
        });
        SrvUtil.app.get('/api/bake', function (req, res) {
            let qs = req.query;
            if (!SrvUtil.checkSecret(qs, res))
                return;
            let keys = Object.keys(qs);
            if (!keys.includes(SrvUtil.folderProp)) {
                SrvUtil.ret(res, 'no folder');
                return;
            }
            try {
                let msg = SrvUtil.bake(qs[SrvUtil.folderProp]);
                SrvUtil.ret(res, msg);
            }
            catch (err) {
                SrvUtil.ret(res, err);
            }
        });
        return this;
    }
    start() {
        SrvUtil.app.use(express.static(SrvUtil.WWW));
        SrvUtil.app.listen(SrvUtil.prop.port, function () {
            logger.trace('port ' + SrvUtil.prop.port);
        });
    }
}
exports.Srv = Srv;
module.exports = {
    Srv, FileOps, MetaAdmin
};
