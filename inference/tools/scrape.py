import re
import requests
from bs4 import BeautifulSoup
from autoscraper import AutoScraper


def func__scrape(url="https://en.wikipedia.org/wiki/Self-help_group_(finance)"):
    req = BeautifulSoup(requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}).text, 'html.parser').select_one('#mw-content-text p').get_text().strip()
    res = AutoScraper().build(url=url, html=requests.get("https://en.wikipedia.org/wiki/Self-help_group_(finance)", headers={'User-Agent': 'Mozilla/5.0'}).text, wanted_list=[req])
    reqres = [re.sub(r'\[\d+\]', '', itr) for itr in res]

    return reqres