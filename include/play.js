const ytdlDiscord = require("ytdl-core-discord");
const scdl = require("soundcloud-downloader");
const { canModifyQueue } = require("../util/EvobotUtil");

module.exports = {
  async play(song, message) {
    const { PRUNING, SOUNDCLOUD_CLIENT_ID } = require("../config.json");
    const queue = message.client.queue.get(message.guild.id);

    if (!song) {
      queue.channel.leave();
      message.client.queue.delete(message.guild.id);
      return queue.textChannel.send("<a:Chekbaru:712209716645724221> Music queue is ended.").catch(console.error);
    }

    let stream = null;

    try {
      if (song.url.includes("youtube.com")) {
        stream = await ytdlDiscord(song.url, { highWaterMark: 1 << 25 });
      } else if (song.url.includes("soundcloud.com") && SOUNDCLOUD_CLIENT_ID) {
        const info = await scdl.getInfo(song.url, SOUNDCLOUD_CLIENT_ID);
        const opus = scdl.filterMedia(info.media.transcodings, { format: scdl.FORMATS.OPUS });
        stream = await scdl.downloadFromURL(opus[0].url, SOUNDCLOUD_CLIENT_ID);
      }
    } catch (error) {
      if (queue) {
        queue.songs.shift();
        module.exports.play(queue.songs[0], message);
      }

      console.error(error);
      return message.channel.send(`Error: ${error.message ? error.message : error}`);
    }

    queue.connection.on("disconnect", () => message.client.queue.delete(message.guild.id));

    const type = song.url.includes("youtube.com") ? "opus" : "ogg/opus";
    const dispatcher = queue.connection
      .play(stream, { type: type })
      .on("finish", () => {
        if (collector && !collector.ended) collector.stop();

        if (queue.loop) {
          // if loop is on, push the song back at the end of the queue
          // so it can repeat endlessly
          let lastSong = queue.songs.shift();
          queue.songs.push(lastSong);
          module.exports.play(queue.songs[0], message);
        } else {
          // Recursively play the next song
          queue.songs.shift();
          module.exports.play(queue.songs[0], message);
        }
      })
      .on("error", (err) => {
        console.error(err);
        queue.songs.shift();
        module.exports.play(queue.songs[0], message);
      });
    dispatcher.setVolumeLogarithmic(queue.volume / 100);

    const { MessageEmbed } = require("discord.js")
    const prodev = new MessageEmbed()
    .setTitle("Start Playing Music")
    .setDescription(`<a:HatiMel:712209640750055464> SONG : **${song.title}** \n<a:HatiMel:712209640750055464> DURATION : **${song.duration} second** \n<a:HatiMel:712209640750055464> LINK : [${song.title}](${song.url}) \n<a:HatiMel:712209640750055464> PLAYER : ${message.author}`)
    .setColor("FFF000");

    try {
      var playingMessage = await queue.textChannel.send(prodev);
      await playingMessage.react("⏭");
      await playingMessage.react("⏯");
      await playingMessage.react("🔁");
      await playingMessage.react("⏹");
    } catch (error) {
      console.error(error);
    }

    const filter = (reaction, user) => user.id !== message.client.user.id;
    var collector = playingMessage.createReactionCollector(filter, {
      time: song.duration > 0 ? song.duration * 1000 : 600000
    });

    collector.on("collect", (reaction, user) => {
      if (!queue) return;
      const member = message.guild.member(user);

    const skip = new MessageEmbed()
    .setTitle(`${user} Succes Skipped The Song`)
    const pause = new MessageEmbed()
    .setTitle(`${user} Has Pause The Music`)
    const resume = new MessageEmbed()
    .setTitle(`${user} Has Resume The Music\nStarted Resume **`${song.title}`** now`)
    const lolp = new MessageEmbed()
    .setTitle(`Loop is now ${queue.loop ? "**on**" : "**off**"}`)
    const plsstop = new MessageEmbed()
    .setTitle(`${user} Stopped The Music!\nBye Bye 👋`)

      switch (reaction.emoji.name) {
        case "⏭":
          queue.playing = true;
          reaction.users.remove(user).catch(console.error);
          if (!canModifyQueue(member)) return;
          queue.connection.dispatcher.end();
          queue.textChannel.send(skip).catch(console.error);
          collector.stop();
          break;

        case "⏯":
          reaction.users.remove(user).catch(console.error);
          if (!canModifyQueue(member)) return;
          if (queue.playing) {
            queue.playing = !queue.playing;
            queue.connection.dispatcher.pause(true);
            queue.textChannel.send(pause).catch(console.error);
          } else {
            queue.playing = !queue.playing;
            queue.connection.dispatcher.resume();
            queue.textChannel.send(resume).catch(console.error);
          }
          break;

        case "🔁":
          reaction.users.remove(user).catch(console.error);
          if (!canModifyQueue(member)) return;
          queue.loop = !queue.loop;
          queue.textChannel.send(loolp).catch(console.error);
          break;

        case "⏹":
          reaction.users.remove(user).catch(console.error);
          if (!canModifyQueue(member)) return;
          queue.songs = [];
          queue.textChannel.send(plsstop).catch(console.error);
          try {
            queue.connection.dispatcher.end();
          } catch (error) {
            console.error(error);
            queue.connection.disconnect();
          }
          collector.stop();
          break;

        default:
          reaction.users.remove(user).catch(console.error);
          break;
      }
    });

    collector.on("end", () => {
      playingMessage.reactions.removeAll().catch(console.error);
      if (PRUNING && playingMessage && !playingMessage.deleted) {
        playingMessage.delete({ timeout: 3000 }).catch(console.error);
      }
    });
  }
};
