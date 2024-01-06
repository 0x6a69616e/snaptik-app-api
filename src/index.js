const
  axios = require('axios'),
  cheerio = require('cheerio'),
  FormData = require('form-data');

module.exports = class {
  constructor(config = {}) {
    function randomInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    this.axios = axios.create(this.config = Object.assign({
      baseURL: 'https://snaptik.app',
      headers: {
        'User-Agent': `Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.${randomInt(0, 9999)}.${randomInt(0, 99)} Safari/537.36`
      }
    }, config));
  }

  async get_token() {
    const {
      data
    } = await this.axios.get('/');
    return cheerio.load(data)('input[name="token"]').val();
  }

  eval_script(script) {
    const
      $ = cheerio.load('<div id="hero"></div><div id="download"></div><div class="contents"></div>'),
      args = Function('$', `return{$,document:{getElementById:a=>({src:''})},gtag:a=>0,Math:{round:a=>0},window:{location:{hostname:'snaptik.app'}},XMLHttpRequest:Function('this.open=this.send=a=>0')}`)($);

    $.prototype.style = {};
    Object.defineProperty($.prototype, 'innerHTML', {
      get: Function('return this.html()'),
      set: Function('a', 'this.html(a)')
    });

    const video_url = Function(...Object.keys(args), `let fetch=a=>{fetch=a;return{json:a=>({thumbnail_url:''})}};${script};return fetch;`)(...Object.values(args));

    return [
      $('#download').html(),
      video_url
    ]
  }

  parse_html(html) {
    const
      $ = cheerio.load(html);

    return [
      $('div.video-links > button[data-tokenhd]').data('tokenhd'),
      $('div.video-links > a:not(a[href="/"])').toArray().map(elem => $(elem).attr('href')).map(x => x.startsWith('/') ? this.config.baseURL + x : x)
    ]
  }

  async get_hd_video(token) {
    const {
      data: {
        error,
        url
      }
    } = await this.axios.get('/getHdLink.php?token=' + token);

    if (error) throw new Error(error);
    return url;
  }

  parse_oembed_html(html) {
    const
      $ = cheerio.load(html),
      music = $('section > a:last-child'),
      video = $('blockquote');

    return {
      title: $('p').contents().filter(Function('return this.nodeType === 3')).text().trim(),
      tags: $('p > a').toArray().map(elem => [$(elem).attr('title'), $(elem).attr('href')]),
      music_name: music.attr('title'),
      music_url: music.attr('href'),
      video_url: video.attr('cite'),
      video_id: video.data('video-id')
    }
  }

  async process(url) {
    const
      token = await this.get_token(),
      form = new FormData();

    this.token = token;

    form.append('token', token);
    form.append('url', url);

    function atob(data) {
      return Buffer.from(data, 'base64').toString('binary');
    }

    const {
      data
    } = await this.axios.post('/abc2.php', form),
      [
        globals,
        fn
      ] = data.match(/(.*)eval\((function.*)\)/).slice(1),
      script = Function(`${globals}return (${fn})`)(),
      [
        html,
        oembed_url
      ] = this.eval_script(script),
      [
        _token,
        srcs
      ] = this.parse_html(html), {
        id
      } = JSON.parse(atob(_token.split('.')[1]));

    return {
      sources: [
        async () => await this.get_hd_video(_token),
        ...srcs
      ],
      oembed: {
        url: oembed_url,
        get_data: async () => {
          const {
            data
          } = await this.axios.get('/oembed?url=https://www.tiktok.com/@tiktok/video/' + id, {
            baseURL: 'https://www.tiktok.com'
          });
          data['_html'] = this.parse_oembed_html(data.html);
          return data
        }
      },
      video_id: id
    }
  }
}
