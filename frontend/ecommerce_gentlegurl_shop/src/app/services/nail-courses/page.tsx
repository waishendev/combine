import { ServicesPageLayout } from "@/components/services/ServicesPageLayout";

const services = [
  { title: "适合对象", description: "只适合刚入行新手小白或爱好者。" },
  { title: "课程模式", description: "线上/线下授课，提供免费线上询问一年。" },
  { title: "课程天数", description: "3天精华满满浓缩版课程。" },
  { title: "上课时间", description: "10am-4pm（包含一小时午餐休息）。" },
  { title: "地点", description: "Gentlegurls, 14 Lebuh Cintra, Penang。" },
  { title: "毕业文凭", description: "课后提供工作室毕业文凭。" },
];

const pricing = [
  { label: "学费（优惠价）", price: "RM3888" },
  { label: "定金", price: "RM888" },
  { label: "包工具 / 机器 / 材料", price: "已包含" },
  { label: "课程天数", price: "3天" },
  { label: "上课时间", price: "10am-4pm" },
];

const faqs = [
  {
    question: "课程 Day 1",
    answer:
      "• 认识美甲工具和笔刷 • 认识指甲结构 • 了解甲型与手型搭配 • 学习修不同甲型 • 修剪死皮方式 • 前置处理日式+俄式 • 搓条使用方式 • 建构教程 • 涂单色技巧 • 功能胶用法和讲解",
  },
  {
    question: "课程 Day 2",
    answer:
      "• 甲片延长半贴操作 • 顺序消毒方式 • 堆钻法 • 贴饰品教程 • 真人实操练习延长 • 卸甲教程",
  },
  {
    question: "课程 Day 3",
    answer:
      "• 腮红美甲教程 • 多种猫眼技巧 • 渐变操作方式 • 魔镜粉教程 • 格纹教程 • 经典法式 • 玻璃纸/亮片 • 基础晕染 • 花瓣彩绘胶用法 • 简单绘画 • 豹纹 • 斑马纹 • 小香风 • 基础线条笔控 • 真人实操练习设计款 • 学习拆解美甲设计款 • 了解如何回答客人常问的问题",
  },
  {
    question: "学费包含材料",
    answer:
      "• 课程课本 • 建构胶 • 光疗灯 • 打磨机与基本打磨头 • 死皮剪 • 指甲剪 • 搓条 • 营养油 • 色胶（透色x1、实色x1、封层x1） • 点珠笔/建构笔/彩绘笔 • 酒精 • 棉片盒 • 粉尘刷 • 工具箱",
  },
  {
    question: "学员自备",
    answer: "• 小食（以防上课加时） • 干净的空手指（有美甲请先卸除）",
  },
];

const notes = [
  "上课前一个星期需付清全款。",
  "学费已包含工具、机器与材料。",
  "提供免费线上询问一年。",
  "课程结束可获得工作室毕业文凭。",
];

export default function NailCoursesPage() {
  return (
    <ServicesPageLayout
      title="美甲全科班"
      subtitle="线上/线下｜只适合刚入行新手小白或爱好者"
      services={services}
      pricing={pricing}
      faqs={faqs}
      notes={notes}
      heroImage="/images/placeholder.png"
    />
  );
}
