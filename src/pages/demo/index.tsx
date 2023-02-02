import { View, Button, Image } from "@tarojs/components"
import Taro from "@tarojs/taro"
import { useState } from "react"
import { ImageClipper } from "../../components/image-clipper"
import "./index.scss"

// 图片裁剪使用Demo
export default () => {
  // 是否展示裁剪器
  const [showClipper, setShowClipper] = useState(false)
  // 选择的原始图片
  const [originalImage, setOriginalImage] = useState("")
  // 裁剪后图片
  const [clippedImage, setClippedImage] = useState("")

  return (
    <View >
      <View style={{ padding: '20rpx' }}>
        {/* 选择图片按钮 */}
        <Button
          onClick={() => {
            Taro.chooseImage({
              count: 1,
            }).then((res) => {
              setShowClipper(true)
              setOriginalImage(res.tempFilePaths[0])
            })
          }}
        >
          选择图片
        </Button>
        <View style={{ margin: '20px 0' }}>裁剪结果：</View>
        {/* 裁剪结果展示 */}
        <Image
          src={clippedImage}
          style={{
            borderRadius: "16rpx",
            height: "500rpx",
            width: "500rpx",
          }}
        />
      </View>
      {/* 裁剪组件 */}
      <ImageClipper
        visible={showClipper}
        src={originalImage}
        onCut={(imgPath) => {
          setClippedImage(imgPath)
          setShowClipper(false)
        }}
        onCancel={() => {
          setShowClipper(false)
        }}
      />
    </View>
  )
}
