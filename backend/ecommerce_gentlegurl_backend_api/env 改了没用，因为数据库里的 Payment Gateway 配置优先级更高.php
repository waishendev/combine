env 改了没用，因为数据库里的 Payment Gateway 配置优先级更高，把你盖掉了。

当前实际解析结果是：

项	实际值	来源
base_url
https://www.billplz-sandbox.com/api/v3
DB payment_gateways[ecommerce.billplz_fpx]
api_key
sandbox 真钥匙 f59b09ec-...
DB（不是你 .env 的 local-api-key）
所以付款会去 Billplz sandbox，不是本地 127.0.0.1:4400。

优先级在代码里是：

DB payment_gateways.config.base_url ← 你现在卡在这里
才轮到 .env 的 BILPLZ_BASE_URL
最后才是默认值
ecommerce / booking 的 billplz_fpx、billplz_card 四条记录都还是 sandbox。

怎么改： 在 CRM 里把 Billplz gateway 改成 simulator，或直接改 DB：

Base URL: http://127.0.0.1:4400/api/v3
API key: local-api-key
Collection ID: local-collection
X-signature: local-signature-key
改完后确认本地 simulator 在 4400 跑着，再下单测一次。

需要的话我可以帮你把这 4 条 DB 记录改成 local simulator。



Agent

PAYMENT  FLOW