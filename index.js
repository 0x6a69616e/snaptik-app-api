const
  axios = require('axios'),
  cheerio = require('cheerio'),
  FormData = require('form-data');

module.exports = class {
  constructor(config) {
    this.axios = axios.create(config);
  }

  async get_token() {
    const {
      data
    } = await this.axios.get('https://snaptik.app');
    return cheerio.load(data)('input[name="token"]')
      .val();
  }

  eval_script(script) {
    const
      $ = cheerio.load('<div id="hero"></div><div id="download"></div><div class="contents"></div>'),
      obj = {
        $,
        document: {
          getElementById: Function('return {}')
        },
        fetch: async function() {
          return {
            json: async function() {
              return {
                thumbnail_url: ''
              }
            }
          }
        },
        gtag: Function(),
        Math: {
          round() {
            return 0;
          }
        },
        window: {
          location: {
            hostname: 'snaptik.app'
          }
        },
        XMLHttpRequest: class {
          open() {}
          send() {}
        }
      };

    $.prototype.style = {};
    Object.defineProperty($.prototype, 'innerHTML', {
      get: function() {
        return this.html();
      },
      set: function(value) {
        this.html(value);
      }
    });

    Function(...Object.keys(obj), script)(...Object.values(obj));

    return $('#download')
      .html();
  }

  eval_html(html) {
    const
      $ = cheerio.load(html);

    return [
      $('div.video-links > button[data-tokenhd]').data('tokenhd'),
      $('div.video-links > a:not(a[href="/"])').toArray().map(elem => $(elem).attr('href')).map(x => x.startsWith('/') ? 'https://snaptik.app' + x : x)
    ]
  }

  async get_oembed(token) {
    const {
      id
    } = JSON.parse(atob(token.split('.')[1])), {
      data
    } = await this.axios.get('https://www.tiktok.com/oembed?url=https://www.tiktok.com/@tiktok/video/' + id);

    return data;
  }

  async get_hd_video(token) {
    const {
      data: {
        error,
        url
      }
    } = await this.axios.get('https://snaptik.app/getHdLink.php?token=' + token);

    if (error) throw new Error(error);
    return url;
  }

  async process(url) {
    const
      token = await this.get_token(),
      form = new FormData();

    form.append('token', token);
    form.append('url', url);

    const {
      data
    } = await this.axios({
        url: 'https://snaptik.app/abc2.php',
        method: 'POST',
        data: form
      }),
      [
        globals,
        fn
      ] = data.match(/(.*)eval\((function.*)\)/).slice(1),
      script = Function(`${globals}return (${fn})`)(),
      html = this.eval_script(script),
      [
        _token,
        srcs
      ] = this.eval_html(html);

    return {
      tt_oembed: await this.get_oembed(_token),
      video_src: [
        await this.get_hd_video(_token),
        ...srcs
      ]
    }
  }
}
