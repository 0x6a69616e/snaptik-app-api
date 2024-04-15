const axios = require('axios');
const cheerio = require('cheerio');
const FormData = require('form-data');

class SnapTikClient {
  constructor(config = {}) {
    this.axios = axios.create(this.config = {
      baseURL: 'https://dev.snaptik.app',
      ...config,
    });
  }

  async get_token() {
    const {
      data
    } = await this.axios({
      url: '/'
    });
    const $ = cheerio.load(data);
    return $('input[name="token"]').val();
  }

  async get_script(url) {
    const form = new FormData();
    const token = await this.get_token();

    form.append('token', token);
    form.append('url', url);

    const {
      data
    } = await this.axios({
      url: '/abc2.php',
      method: 'POST',
      data: form
    });

    return data;
  }

  async eval_script(script1) {
    const script2 = await new Promise(resolve => Function('eval', script1)(resolve));
    return new Promise((resolve, reject) => {
      let html = '';
      const [
        k,
        v
      ] = [
        'keys',
        'values'
      ].map(x => Object[x]({
        $: () => Object.defineProperty({
          remove() {},
          style: {
            display: ''
          }
        }, 'innerHTML', {
          set: t => (html = t)
        }),
        app: {
          showAlert: reject
        },
        document: {
          getElementById: () => ({
            src: ''
          })
        },
        fetch: a => {
          return resolve({
            html,
            oembed_url: a
          }), {
            json: () => ({
              thumbnail_url: ''
            })
          };
        },
        gtag: () => 0,
        Math: {
          round: () => 0
        },
        XMLHttpRequest: function() {
          return {
            open() {},
            send() {}
          }
        },
        window: {
          location: {
            hostname: 'snaptik.app'
          }
        }
      }));
      Function(...k, script2)(...v);
    });
  }

  async get_hd_video(token) {
    const {
      data: {
        error,
        url
      }
    } = await this.axios({
      url: '/getHdLink.php?token=' + token
    });

    if (error) throw new Error(error);
    return url;
  }

  async parse_html(html) {
    const $ = cheerio.load(html);
    const is_video = !$('div.render-wrapper').length;

    return is_video ? (async () => {
      const hd_token = $('div.video-links > button[data-tokenhd]').data('tokenhd');
      const hd_url = new URL(await this.get_hd_video(hd_token));
      const token = hd_url.searchParams.get('token');
      const raw_hd_url = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).url;

      return {
        type: 'video',
        data: {
          sources: [
            raw_hd_url,
            hd_url.href,
            ...$('div.video-links > a:not(a[href="/"])')
            .toArray()
            .map(elem => $(elem).attr('href'))
            .map(x => x.startsWith('/') ? this.config.baseURL + x : x)
          ]
        }
      }
    })() : {
      type: 'slideshow',
      data: {
        photos: $('div.columns > div.column > div.photo').toArray().map(elem => ({
          sources: [
            $(elem).find('img').attr('src'),
            $(elem).find('a').attr('href')
          ]
        }))
      }
    }
  }

  async process(url) {
    const script = await this.get_script(url);

    const {
      html,
      oembed_url
    } = await this.eval_script(script);

    return {
      ...(await this.parse_html(html)),
      url,
      oembed_url,
      script
    };
  }
}

module.exports = SnapTikClient;