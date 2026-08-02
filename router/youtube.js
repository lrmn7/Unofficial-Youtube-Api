__path = process.cwd();
const express = require("express");
const router = express.Router();
const { YoutubeSearch, YoutubeUser, YoutubePlaylist } = require("../lib/youtube");

router.get("/", async(req, res) => {
    res.status(400).json({
        author: "lrmn7",
        message: "Ooopss, you can go to router /search for more details."
    })
})
router.get("/search", async(req, res) => {
    let channel = req.query.channel
    let video = req.query.video
    let playlist = req.query.playlist
    let all = req.query.all

    if (channel) {
        let result = await YoutubeSearch(channel);
        if (result.channel.length == 0) return res.status(400).json({
            author: "lrmn7",
            message: "Channel not found."
        });
        res.status(200).json({
            author: "lrmn7",
            result: result.channel
        });
    } else if (video) {
        let result = await YoutubeSearch(video);
        if (result.video.length == 0) return res.status(400).json({
            author: "lrmn7",
            message: "Video not found."
        });
        res.status(200).json({
            author: "lrmn7",
            result: result.video
        });
    } else if (playlist) {
        let result = await YoutubeSearch(playlist);
        if (result.playlist.length == 0) return res.status(400).json({
            author: "lrmn7",
            message: "Playlist not found."
        });
        res.status(200).json({
            author: "lrmn7",
            result: result.playlist
        });
    } else if (all) {
        let result = await YoutubeSearch(all);
        res.status(200).json({
            author: "lrmn7",
            result
        })
    } else {
        res.status(400).json({
            author: "lrmn7",
            message: "Enter parameters, available parameters: channel, video, playlist, all."
        })
    }
});

router.get("/user", async(req, res) => {
    let username = req.query.username;
    if (!username) {
        return res.status(400).json({
            author: "lrmn7",
            message: "Parameter username is required."
        });
    }

    try {
        let result = await YoutubeUser(username);
        res.status(200).json({
            author: "lrmn7",
            result
        });
    } catch (error) {
        res.status(400).json({
            author: "lrmn7",
            message: error.message
        });
    }
});


router.get("/playlist", async (req, res) => {
    const id = req.query.id;
    if (!id) return res.status(400).json({ status: 400, message: "Playlist ID is required." });
    try {
        const result = await YoutubePlaylist(id);
        res.status(200).json({
            author: "lrmn7",
            status: 200,
            result
        });
    } catch (e) {
        res.status(500).json({
            status: 500,
            message: e.message
        });
    }
});

module.exports = router;