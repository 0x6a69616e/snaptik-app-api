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

  async eval_script(script) {
    const
        $ = cheerio.load('<div id="hero"></div><div id="download"></div><div class="contents"></div>'),
        obj = {
          $,
          document: {
            getElementById: function() {
              return {}
            }
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
          gtag: function() {},
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
    
    Object.defineProperty($.prototype, 'innerHTML', {
      get: function() {
        return this.html();
      },
      set: function(value) {
        this.html(value);
      }
    });
    $.prototype.style = {};
    
    Function(...Object.keys(obj), script)(...Object.values(obj));

    return $('#download')
      .html();
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
      }), [globals, fn] = data.match(/(.*)eval\((function.*)\)/)
      .slice(1), script = Function(`${globals}return (${fn})`)();

    return await this.eval_script(script);
  }
}
