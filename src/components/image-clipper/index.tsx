import { CSSProperties, FC, useEffect, useMemo, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { Button, Canvas, Image, View } from '@tarojs/components'
import './index.scss'

// eslint-disable-next-line no-shadow
enum FileType {
  jpg = 'jpg',
  png = 'png'
}

export interface IImageClipperProps {
  /**
   * 是否展示组件
   */
  visible: boolean
  /**
   * 要裁剪的图片
   */
  src: string
  /**
   * 裁剪框宽度
   */
  clipperWidth?: number
  /**
   * 裁剪框高度
   */
  clipperHeight?: number
  /**
   * 最大放大倍数，maxScale >= 1
   */
  maxScale?: number
  /**
   * 裁剪后导出的图片的格式，只支持 'jpg' 或 'png'。默认为 'jpg'
   */
  fileType?: FileType
  /**
   * 导出图片的质量，取值为 0 ~ 1，默认为1
   */
  quality?: number
  /**
   * 用于裁剪的canvas id
   */
  clipperCutCanvasId?: string
  /**
   * 点击底部的完成按钮，执行裁剪，成功则触发该回调
   */
  onCut?: (imgPath: string) => void
  /**
   * 点击取消按钮回调
   */
  onCancel?: () => void
}

export const ImageClipper: FC<IImageClipperProps> = (props) => {
  const {
    visible,
    src,
    clipperWidth = 500,
    clipperHeight = 500,
    maxScale = 5,
    fileType = FileType.jpg,
    quality = 1,
    clipperCutCanvasId = 'clipperCutCanvasId',
    onCancel = () => { },
    onCut = () => { }
  } = props

  enum EventType {
    move = 'move',
    scale = 'scale'
  }

  const { screenWidth, windowWidth, windowHeight, pixelRatio } = useMemo(() => {
    const systemInfo = Taro.getSystemInfoSync()
    return {
      pixelRatio: systemInfo.pixelRatio,
      screenWidth: systemInfo.screenWidth,
      windowHeight: systemInfo.windowHeight,
      windowWidth: systemInfo.windowWidth
    }
  }, [])

  //底图的大小和位置
  const [imgTop, setImgTop] = useState(0)
  const [imgLeft, setImgLeft] = useState(0)
  const [imgWidth, setImgWidth] = useState(0)
  const [imgHeight, setImgHeight] = useState(0)
  //是否展示canvas；为了提高性能，onTouchMove时不展示
  const [showCanvas, setShowCanvas] = useState(true)

  /**
   * 单位转换
   */
  const rpxToPX = (value: number) => {
    return (value / 750) * screenWidth
  }

  const clipperCutCanvasContext = useRef(Taro.createCanvasContext(clipperCutCanvasId))
  //底图位置
  const imageLeft = useRef(0)
  const imageTop = useRef(0)
  //底图上一次位置
  const imageLeftPre = useRef(0)
  const imageTopPre = useRef(0)
  //裁剪框大小
  const clipperWidthPX = useRef(rpxToPX(clipperWidth))
  const clipperHeightPX = useRef(rpxToPX(clipperHeight))
  const imageInfo = useRef({
    errMsg: '',
    height: 0,
    orientation: 'up',
    path: '',
    type: '',
    width: 0
  })
  //底图原始大小
  const realImageWidth = useRef(0)
  const realImageHeight = useRef(0)
  //底图缩放后大小
  const scaleImageWidth = useRef(0)
  const scaleImageHeight = useRef(0)

  /**
   * 更新底图位置和大小，更新裁剪区域
   */
  const update = () => {
    if (!imageInfo.current) {
      // 图片资源无效则不执行更新操作
      return
    }

    //更新底图位置和大小
    setImgLeft(imageLeft.current)
    setImgTop(imageTop.current)
    setImgWidth(scaleImageWidth.current)
    setImgHeight(scaleImageHeight.current)

    //绘制裁剪框内部的区域
    if (showCanvas) {
      const clipperStartX = (windowWidth - clipperWidthPX.current) / 2
      const clipperStartY = (windowHeight - clipperHeightPX.current) / 2

      const clipperImageX =
        ((clipperStartX - imageLeft.current) / scaleImageWidth.current) * imageInfo.current.width
      const clipperImageY =
        ((clipperStartY - imageTop.current) / scaleImageHeight.current) * imageInfo.current.height
      const clipperImageWidth =
        (clipperWidthPX.current / scaleImageWidth.current) * imageInfo.current.width
      const clipperImageHeight =
        (clipperHeightPX.current / scaleImageHeight.current) * imageInfo.current.height
      // 绘制裁剪框内裁剪的图片
      clipperCutCanvasContext.current.drawImage(
        imageInfo.current.path,
        clipperImageX,
        clipperImageY,
        clipperImageWidth,
        clipperImageHeight,
        0,
        0,
        clipperWidthPX.current,
        clipperHeightPX.current
      )
      clipperCutCanvasContext.current.draw(false)
    }
  }

  /**
   * 初始化图片信息
   */
  useEffect(() => {
    const init = () => {
      Taro.getImageInfo({ src: src }).then((res) => {
        imageInfo.current = { ...res }
        if (
          imageInfo.current.width / imageInfo.current.height <
          clipperWidthPX.current / clipperHeightPX.current
        ) {
          // 宽度充满
          scaleImageWidth.current = realImageWidth.current = clipperWidthPX.current
          scaleImageHeight.current = realImageHeight.current =
            (realImageWidth.current * imageInfo.current.height) / imageInfo.current.width
          imageLeftPre.current = imageLeft.current = (windowWidth - clipperWidthPX.current) / 2
          imageTopPre.current = imageTop.current = (windowHeight - realImageHeight.current) / 2
        } else {
          scaleImageHeight.current = realImageHeight.current = clipperHeightPX.current
          scaleImageWidth.current = realImageWidth.current =
            (realImageHeight.current * imageInfo.current.width) / imageInfo.current.height
          imageLeftPre.current = imageLeft.current = (windowWidth - realImageWidth.current) / 2
          imageTopPre.current = imageTop.current = (windowHeight - clipperHeightPX.current) / 2
        }
        update()
        return Promise.resolve()
      })
    }
    if (src) {
      init()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  /**
   * 图片移动边界检测
   */
  const outsideBound = (left: number, top: number) => {
    if (left > (windowWidth - clipperWidthPX.current) / 2) {
      imageLeft.current = (windowWidth - clipperWidthPX.current) / 2
    } else if (left + scaleImageWidth.current >= (windowWidth + clipperWidthPX.current) / 2) {
      imageLeft.current = left
    } else {
      imageLeft.current = (windowWidth + clipperWidthPX.current) / 2 - scaleImageWidth.current
    }

    if (top > (windowHeight - clipperHeightPX.current) / 2) {
      imageTop.current = (windowHeight - clipperHeightPX.current) / 2
    } else if (top + scaleImageHeight.current >= (windowHeight + clipperHeightPX.current) / 2) {
      imageTop.current = top
    } else {
      imageTop.current = (windowHeight + clipperHeightPX.current) / 2 - scaleImageHeight.current
    }
  }

  //单指接触屏幕时，记录坐标
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  //双指接触屏幕时，记录两指距离
  const touchDistance = useRef(0)
  //放大倍数
  const oldScale = useRef(1)
  const newScale = useRef(1)
  //手指move前图片的大小
  const lastScaleImageWidth = useRef(0)
  const lastScaleImageHeight = useRef(0)
  //事件，单指move，双值缩放
  const eventType = useRef(EventType.move)

  /**
   * 计算新的放大倍数
   */
  const getNewScale = (touch0: any, touch1: any) => {
    const xMove = touch1.clientX - touch0.clientX
    const yMove = touch1.clientY - touch0.clientY
    const newDistance = Math.sqrt(xMove * xMove + yMove * yMove)
    return oldScale.current + 0.01 * (newDistance - touchDistance.current)
  }

  const oneTouchStart = (touch: any) => {
    touchStartX.current = touch.clientX
    touchStartY.current = touch.clientY
  }

  const twoTouchStart = (touch0: any, touch1: any) => {
    const xMove = touch1.clientX - touch0.clientX
    const yMove = touch1.clientY - touch0.clientY
    lastScaleImageWidth.current = scaleImageWidth.current
    lastScaleImageHeight.current = scaleImageHeight.current
    // 计算得到初始时两指的距离
    touchDistance.current = Math.sqrt(xMove * xMove + yMove * yMove)
  }

  const oneTouchMove = (touch: any) => {
    const xMove = touch.clientX - touchStartX.current
    const yMove = touch.clientY - touchStartY.current
    outsideBound(imageLeftPre.current + xMove, imageTopPre.current + yMove)
    update()
  }

  const twoTouchMove = (touch0: any, touch1: any) => {
    const realMaxScale = maxScale >= 1 ? maxScale : 1
    newScale.current = getNewScale(touch0, touch1)
    // 限制缩放
    newScale.current <= 1 && (newScale.current = 1)
    newScale.current > realMaxScale && (newScale.current = realMaxScale)

    scaleImageWidth.current = realImageWidth.current * newScale.current
    scaleImageHeight.current = realImageHeight.current * newScale.current
    const newLeft =
      imageLeftPre.current - (scaleImageWidth.current - lastScaleImageWidth.current) / 2
    const newTop =
      imageTopPre.current - (scaleImageHeight.current - lastScaleImageHeight.current) / 2

    outsideBound(newLeft, newTop)
    update()
  }

  const handleOnTouchEnd = () => {
    oldScale.current = newScale.current
    imageLeftPre.current = imageLeft.current
    imageTopPre.current = imageTop.current
    setShowCanvas(true)
  }

  //手指离开屏幕时，绘制裁剪区域内容
  useEffect(() => {
    if (showCanvas) {
      update()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCanvas])

  const handleOnTouchStart = (e) => {
    setShowCanvas(false)
    if (!src) return
    // 两指手势触发
    if (e.touches.length >= 2) {
      eventType.current = EventType.scale
      twoTouchStart(e.touches[0], e.touches[1])
    } else {
      // 计算第一个触摸点的位置，并参照改点进行缩放
      eventType.current = EventType.move
      oneTouchStart(e.touches[0])
    }
  }

  const handleOnTouchMove = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!src) return
    // 单指手势触发
    if (e.touches.length === 1 && eventType.current === EventType.move) {
      oneTouchMove(e.touches[0])
    } else if (e.touches.length >= 2) {
      // 双指手势触发
      twoTouchMove(e.touches[0], e.touches[1])
    }
  }

  /**
   * 将当前裁剪框区域的图片导出
   */
  const cut = (): Promise<{
    errMsg: string
    filePath: string
  }> => {
    return new Promise((resolve, reject) => {
      Taro.showLoading({ title: '裁剪中' })
      Taro.canvasToTempFilePath(
        {
          canvasId: clipperCutCanvasId,
          complete: () => {
            Taro.hideLoading()
          },
          destHeight: clipperHeightPX.current * pixelRatio,
          destWidth: clipperWidthPX.current * pixelRatio,
          fail: (err) => {
            reject(err)
          },
          fileType: fileType,
          height: clipperHeightPX.current - 2,
          quality: quality,
          success: (res) => {
            resolve({
              errMsg: res.errMsg,
              filePath: res.tempFilePath
            })
          },
          width: clipperWidthPX.current - 2,
          x: 0,
          y: 0
        },
        this
      )
    })
  }

  const cutCanvasStyle: CSSProperties = {
    height: `${clipperHeightPX.current}px`,
    left: `${(windowWidth - clipperWidthPX.current) / 2}px`,
    position: 'absolute',
    top: `${(windowHeight - clipperHeightPX.current) / 2}px`,
    width: `${clipperWidthPX.current}px`,
    zIndex: 10
  }
  const cutBorderStyle: CSSProperties = {
    border: '1px solid #fff',
    boxSizing: 'border-box',
    height: `${clipperHeightPX.current}px`,
    left: `${(windowWidth - clipperWidthPX.current) / 2}px`,
    position: 'absolute',
    top: `${(windowHeight - clipperHeightPX.current) / 2}px`,
    width: `${clipperWidthPX.current}px`,
    zIndex: 100
  }

  return visible ? (
    <View className='clipper'>
      {showCanvas && <Canvas canvasId={clipperCutCanvasId} style={cutCanvasStyle} />}
      <View className='clipper__body'>
        <Image
          src={src}
          style={{
            height: `${imgHeight}px`,
            left: `${imgLeft}px`,
            minWidth: `${imgWidth}px`,
            position: 'absolute',
            top: `${imgTop}px`,
            width: `${imgWidth}px`
          }}
        />
        <View className='clipper__body__mask'></View>
        <View style={cutBorderStyle}></View>
        <View
          className='clipper__body__touch-view'
          onTouchStart={handleOnTouchStart}
          onTouchMove={handleOnTouchMove}
          onTouchEnd={handleOnTouchEnd}
          catchMove
        ></View>
        <Button
          className='clipper__body__button-cancel'
          onClick={onCancel}
          size='mini'
        >
          取消
        </Button>
        <Button
          className='clipper__body__button-sure'
          size='mini'
          type='primary'
          onClick={() => {
            cut().then((res) => {
              onCut(res.filePath)
            })
          }}
        >
          确定
        </Button>
      </View>
    </View>
  ) : null
}
