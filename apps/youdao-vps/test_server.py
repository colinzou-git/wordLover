import unittest

from server import parse_youdao_html


class ParserTests(unittest.TestCase):
    def test_basic_entry(self):
        source = '''<div id="ec" class="trans-container ec"><h2><span>charge</span><div><span>英 <span class="phonetic">[UK]</span></span><span>美 <span class="phonetic">[US]</span></span></div></h2><ul><li>v. 充电；收费</li><li>n. 费用</li></ul><div class="sub"><p class="grey">过去式 charged</p></div></div></div>'''
        entry = parse_youdao_html(source, "charge")
        self.assertEqual(entry["provider"]["label"], "Youdao")
        self.assertEqual(entry["phonetics"], {"uk": "[UK]", "us": "[US]"})
        self.assertEqual([item["text"] for item in entry["chineseDefinitions"]], ["v. 充电；收费", "n. 费用"])
        self.assertEqual(entry["wordForms"], [{"name": "过去式", "value": "charged"}])


if __name__ == "__main__":
    unittest.main()
