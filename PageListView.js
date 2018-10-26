import React, { Component } from 'react';
import {Text,View,ListView,FlatList,Dimensions,PanResponder,Animated,Easing,ActivityIndicator} from 'react-native';
import Styles from 'react-native-gp-style';
let {s,sf}=new Styles(0);

let PageList=FlatList||ListView;
//获取屏幕宽高
const {width:w, height:h}=Dimensions.get('window');

//pullState对应的相应的文字说明
const pullStateTextArr={
    'noPull':'',
    'pulling':'下拉刷新...',
    'pullOk':'释放以刷新...',
    'pullRelease':'正在刷新,请稍等...',
};
//默认动画时长
const defaultDuration=400;

//1.1.0->1.2.0改动/修复/新增:
/*
     1.修复从数据为空的界面切换为有数据的界面时的bug
     2.支持无数据情况下的下拉刷新
     3.让用户自己决定是否要显示下拉刷新界面(根据大家反馈希望可以自定义是否显示下拉刷新,所以就加入了)
     *.缩减renderListView方法中的代码,把style样式的编写方式改为react-native-gp-style
 */

export default class PageListView extends Component{
    constructor(props){
        super(props);
        let {refreshEnable,pageLen}=this.props;
        this.refreshEnable=refreshEnable!==undefined?refreshEnable:!!pageLen;
        this.state={
            //DataSource数据源对应的数组数据
            dataArr:[],
            //ListView的数据源
            dataSource: this.props.isListView?new ListView.DataSource({
                rowHasChanged: (r1, r2)=>r1 !== r2
            }):[],
            //下面两个参数来决定是否可以调用加载更多的方法
            //ListView/FlatView中标识是否可以加载更多(当现在获取到的数据已经是全部了,不能再继续获取数据了,则设为false,当还有数据可以获取则设为true)
            canLoad: false,
            //标识现在是否ListView/FlatView现在正在加载(根据这个值来决定是否显示"正在加载的cell")(loadMore()方法进去后设为true,fetch加载完数据后设为false)
            isLoadding:false,
            //是否显示下拉刷新的cell
            ifShowRefresh:false,
            //ListView/FlatList是否可以滚动
            scrollEnabled:true,
            //记录当前加载到了哪一页
            page:2,

            //通过View自适应的宽高来决定ListView的宽高(或让用户来决定宽高)
            // width:this.props.width||0,
            // height:this.props.height||0,
            width:0,
            height:0,

            //下拉的状态
            pullState:'noPull',
            pullAni:new Animated.Value(-this.props.renderRefreshViewH),

            //网络获取的数据是否为空
            ifDataEmpty:false,
        };
        //创建手势相应者
        this.refreshEnable&&(this.panResponder = PanResponder.create({
            onMoveShouldSetPanResponder: this.onMoveShouldSetPanResponder,
            onPanResponderMove: this.onPanResponderMove,
            onPanResponderRelease: this.onPanResponderRelease,
            onPanResponderTerminate: this.onPanResponderRelease,
            onShouldBlockNativeResponder: ()=>false
        }));
        //下拉到什么位置时算拉到OK的状态
        this.pullOkH=parseInt(this.props.renderRefreshViewH*1.5);
        //记录ListView最后一次滚动停止时的y坐标
        this.lastListY=0;
    }
    static defaultProps={
        //当前控件是否为ListView
        isListView:PageList===ListView,
        //父组件处理"渲染FlatList/ListView的每一行"的方法
        renderRow:null,
        //父组件处理"下拉刷新"或"一开始加载数据"的方法
        refresh:null,
        //父组件处理"加载更多"的方法
        loadMore:null,
        //每个分页的数据数
        pageLen:0,
        //总的数据条数
        allLen:0,

        //如果父组件中包含绝对定位的View时传入ListView的高度
        //或者可以在父组件底部加入相应高度的透明View
        // height:0,
        // width:0,

        //如果需要在用当前后端返回的数组数据进行处理的话,传入回调函数
        dealWithDataArrCallBack:null,
        //如果在进行某个操作后需要对数组数据进行手动处理的话,传入回调函数
        // changeDataArr:null,
        //渲染每行View之间的分割线View
        ItemSeparatorComponent:null,
        //还有数据可以从后端取得时候渲染底部View的方法
        renderLoadMore:null,
        //没有数据(数据已经从后端全部加载完)是渲染底部View的方法
        renderNoMore:null,
        //渲染下拉刷新的View样式
        renderRefreshView:null,
        //渲染下拉刷新的View样式的高度
        renderRefreshViewH:60,

        //如果网络获取数据为空时的渲染界面
        renderEmpty:null,

        //当前组件是否是放在scrollView中(放在ScrollView中时则不能上拉刷新,下拉加载更多)
        inScrollView:false,

        //当前是否要启用下拉刷新功能(如果用户在父组件给出该参数就以该参数的值为准,没有给出,就按默认有分页就启用,没有分页就不启用)
        // refreshEnable:true,

        //是否隐藏当前ListView
        // ifHide:false,
    };

    //取到View自适应的宽高设置给ListView
    onLayout=(event)=>{
        if(this.state.width&&this.state.height){return}
        let {width, height} = event.nativeEvent.layout;
        this.setState({width,height});
    };

    render() {
        let {renderEmpty,renderRefreshViewH,renderRefreshView,inScrollView}=this.props;
        let {ifDataEmpty,width:WS,height:HS,pullState,pullAni}=this.state;
        if(inScrollView){return this.renderListView()}
        return(
            !!this.refreshEnable?
                <View style={[{flex:1},{zIndex:-99999}]} onLayout={this.onLayout}>
                    <Animated.View ref={aniView=>{this.aniView=aniView}} style={[{transform:[{translateY:pullAni}]},sf.swh(WS,HS+renderRefreshViewH)]}>
                        {renderRefreshView?renderRefreshView(pullState):this.renderRefreshView()}
                        <View style={[sf.swh(WS,HS)]} {...this.panResponder.panHandlers}>
                            {ifDataEmpty&&renderEmpty?renderEmpty():this.renderListView()}
                        </View>
                    </Animated.View>
                </View>:<View style={[s.f1]}>
                {ifDataEmpty&&renderEmpty?renderEmpty():this.renderListView()}
            </View>
        );
    }

    //ListView/FlatList的渲染
    renderListView=()=>{
        let {dataSource,scrollEnabled}=this.state;
        let {isListView,pageLen}=this.props;
        let {renderFooter,renderRow,renderItem,renderItemS,onEndReached,onScroll}=this;
        let props={...this.props,style:{}};
        if(!isListView){
            props={...props,renderItem,data:dataSource,ItemSeparatorComponent:renderItemS,keyExtractor:(item,index)=>index.toString(),scrollEnabled,onScroll,};
            if(pageLen){
                props={...props,onEndReached,onEndReachedThreshold:0.05,ListFooterComponent:renderFooter,ref:list=>{this.list=list}};
            }
        }else {
            props={...props,dataSource,renderRow,enableEmptySections:true,scrollEnabled,onScroll};
            if(pageLen){
                props={...props,onEndReached,onEndReachedThreshold:10,renderFooter,ref:list=>{this.list=list}};
            }
        }
        return <PageList {...props}/>
    };


    componentDidMount(){
        this.resetAni();
        this.props.refresh((res)=>{
            if(!this.dealWithArr(res)){return}
            let len=res.length;
            this.updateData(res,len);
        });
        // console.log(this.state.scrollEnabled);
    }

    //当快要接近底部时加载更多
    onEndReached=()=> {
        if (this.state.canLoad && !this.state.isLoadding) {
            this.loadMore();
        }
    };
    //加载更多
    loadMore=()=>{
        this.setState({isLoadding: true});
        let page = this.state.page;
        this.props.loadMore(page,(res)=>{
            let len=res.length;
            this.setState({isLoadding:false,page:this.state.page+1});
            this.updateData(res,len,true);
        });
    };

    //刷新
    refreshCommon=(res)=>{
        this.setState({page:2,ifShowRefresh:false,pullState:'noPull'});
        this.resetAni();
        if(!this.dealWithArr(res)){return}
        let len=res.length;
        this.updateData(res,len);
    };
    //下拉刷新
    refresh=()=>{
        this.props.refresh((res)=>{
            this.refreshCommon(res)
        });
    };
    //手动刷新(父组件中通过该组件的ref调用)
    manualRefresh=(res)=>{
        this.refreshCommon(res);
    };

    //判断传入的数据是否为数组,或数组是否为空
    dealWithArr=(res)=>{
        let isArr=Array.isArray(res);
        if(!isArr){this.setState({ifDataEmpty:true});console.warn('PageListView的数据源需要是一个数组');return false;}
        let len=res.length;
        if(!len){this.setState({ifDataEmpty:true});return false;}
        this.setState({ifDataEmpty:false});
        return true;
    };

    //ListView渲染每一行的cell
    renderRow=(rowData,group,index)=>{
        let {renderRow,ItemSeparatorComponent,pageLen,allLen}=this.props;
        let notLast=parseInt(index)!==this.state.dataArr.length-1;
        let ifRenderItemS=false;
        if(ItemSeparatorComponent){
            if(allLen){
                ifRenderItemS=parseInt(index)!==allLen-1;
            }else {
                ifRenderItemS=(pageLen&&(this.state.canLoad||notLast))||(!pageLen&&notLast);
            }
        }
        // let ifRenderItemS=this.props.ItemSeparatorComponent&&((this.props.pageLen&&(this.state.canLoad||notLast))||(!this.props.pageLen&&notLast));
        return (<View>{renderRow(rowData,index)}{ifRenderItemS&&ItemSeparatorComponent()}</View>);
    };
    //FlatList渲染每一行的cell
    renderItem=({item,index})=>{
        return this.props.renderRow(item,index);
    };

    //渲染cell之间的分割线组件
    renderItemS=()=>{
        return this.props.ItemSeparatorComponent&&this.props.ItemSeparatorComponent();
    };

    //正在加载的cell
    renderFooter=()=>{
        if (!this.state.canLoad) {
            if(this.props.renderNoMore){
                return this.props.renderNoMore();
            }else {
                return (
                    <View style={[s.c,sf.swh(w,40),sf.sbgc('#eee')]}>
                        <Text allowFontScaling={false} style={[sf.scolor('#333'),sf.sfontSize(12)]}>没有更多数据了...</Text>
                    </View>
                );
            }
        } else {
            if(this.props.renderLoadMore){
                return this.props.renderLoadMore();
            }else {
                return (
                    <View style={[s.c,sf.swh(w,40),sf.sbgc('#eee'),s.row]}>
                        <ActivityIndicator animating={this.state.isLoadding} color='#333' size='small' style={[sf.smarR(7)]}/>
                        <Text allowFontScaling={false} style={[sf.scolor('#333'),sf.sfontSize(12)]}>{this.state.isLoadding?'正在加载中,请稍等':'上拉加载更多'}...</Text>
                    </View>
                );
            }
        }
    };

    //更新状态机
    updateData=(res,len,loadMore=false)=>{
        let dataArr=[];
        let {pageLen,allLen}=this.props;
        if(loadMore){
            for(let i=0;i<len;i++){
                this.state.dataArr.push(res[i]);
            }
        }else {
            this.state.dataArr=res;
        }
        !!this.props.dealWithDataArrCallBack?(dataArr=this.props.dealWithDataArrCallBack(this.state.dataArr)):dataArr=this.state.dataArr;
        this.setState({
            dataArr:dataArr,
            dataSource:this.props.isListView?this.state.dataSource.cloneWithRows(dataArr):dataArr,
            canLoad:allLen?(allLen>this.state.dataArr):(pageLen?(len===pageLen):false),
        });
    };

    //如果在进行某个操作后需要对数组数据进行手动处理的话,调用该方法(通过ref来调用refs={(r)=>{!this.PL&&(this.PL=r)}})
    changeDataArr=(callBack)=>{
        let arr=JSON.parse(JSON.stringify(this.state.dataArr));
        let dataArr=callBack(arr);
        this.setState({
            dataArr:dataArr,
            dataSource:this.props.isListView?this.state.dataSource.cloneWithRows(dataArr):dataArr,
        });
    };

    //ListView/FlatList滚动时的方法
    onScroll=(e)=>{
        if(!this.refreshEnable){return}
        this.lastListY=e.nativeEvent.contentOffset.y;
        this.lastListY<=0&&this.setState({scrollEnabled:false})
    };

    //开始移动时判断是否设置当前的View为手势响应者
    onMoveShouldSetPanResponder=(e,gesture)=> {
        // if(!this.props.pageLen)return false;
        let {dy}=gesture;
        let bool;
        if(dy<0){//向上滑
            if(this.state.pullState!=='noPull'){
                this.resetAni();
            }
            !this.state.scrollEnabled&&this.setState({scrollEnabled:true});
            bool=false;
        }else {//向下拉
            if(this.state.pullState!=='noPull'){
                bool=true;
            }else {
                bool=!this.state.scrollEnabled||this.lastListY<1;
            }
        }
        return bool;
    };

    //手势响应者的View移动时
    onPanResponderMove=(e,gesture)=>{
        this.dealWithPan(e,gesture);
    };
    dealWithPan=(e,gesture)=>{
        let {dy}=gesture;
        if(dy<0){//向上滑
            if(this.state.pullState!=='noPull'){
                this.resetAni();
            }else {
                !this.state.scrollEnabled&&this.setState({scrollEnabled:true})
            }
        }else {//向下拉
            let pullDis=gesture.dy/2;
            let pullOkH=this.pullOkH;
            let aniY=pullDis-this.props.renderRefreshViewH;
            this.state.pullAni.setValue(aniY);
            if(pullDis>pullOkH){
                this.setState({pullState:'pullOk'})
            }else if(pullDis>0){
                this.setState({pullState:'pulling'})
            }
        }
    };

    //手势响应者被释放时
    onPanResponderRelease=(e,gesture)=>{
        switch (this.state.pullState){
            case 'pulling':
                this.resetAni();
                this.setState({scrollEnabled:true});
                break;
            case 'pullOk':
                this.resetAniTop();
                this.setState({pullState:'pullRelease',scrollEnabled:true});
                this.refresh();
                break;
        }
    };

    //重置位置 refreshView刚好隐藏的位置
    resetAni=()=>{
        if(!this.refreshEnable){return}
        this.setState({pullState:'noPull'});
        // this.state.pullAni.setValue(this.defaultXY);
        this.resetList();
        Animated.timing(this.state.pullAni, {
            toValue: -this.props.renderRefreshViewH,
            // toValue: this.defaultXY,
            easing: Easing.linear,
            duration: defaultDuration/2
        }).start();
    };
    //重置位置 refreshView刚好显示的位置
    resetAniTop=()=>{
        this.resetList();
        Animated.timing(this.state.pullAni, {
            toValue: 0,
            // toValue: {x:0,y:0},
            easing: Easing.linear,
            duration: defaultDuration/2
        }).start();
    };
    //重置ListView/FlatList位置
    resetList=()=>{
        this.list&&(this.props.isListView?this.list.scrollTo({y:0}):this.list.scrollToOffset({offset:0}));
    };
    //滚动ListView/FlatList位置
    scrollList=(y)=>{
        this.list&&(this.props.isListView?this.list.scrollTo({y:y}):this.list.scrollToOffset({offset:y}));
    };

    //渲染默认的下拉刷新View
    renderRefreshView=()=>{
        return(
            <View style={[sf.swh(w,60),s.c,sf.sbgc('#eee'),s.row]}>
                <ActivityIndicator animating={this.state.pullState==='pullRelease'} color='#333' size='small' style={[sf.smarR(7)]}/>
                <Text allowFontScaling={false} style={{color:'#333',fontSize:15}}>{pullStateTextArr[this.state.pullState]}</Text>
            </View>
        );
    };

}

/*
 待解决问题:
     1.点击无响应:部分手机真机上点击不能触发onPress事件的bug
         bug可能出现出现原因:
             1.应该是当界面滚动到最上方时外层View变成了手势响应者,(此时ListView和FlatList的"scrollEnabled"为false),此时当点击TouchableOpacity的组件时,点击事件被拦截成了手势响应者View的移动事件,所以没有触发onPress事件
             2.因为模拟器上都能正常运行,而是部分手机上会出现这个问题.所以也有可能是因为两者运行的js解析器不一样的关系.
                 开发过程中使用 Chrome 调试时，所有的 JavaScript 代码都运行在 Chrome 中，并且通过 WebSocket 与原生代码通信。此时的运行环境是[V8 引擎]
                 而在手机上时React Native 使用的是[JavaScriptCore],也就是 Safari 所使用的 JavaScript 引擎。
         解决方法:
            尝试1(失败):将"onStartShouldSetPanResponderCapture"设置为false,这样View刚被触碰时就不会成为手势相应者,便可以实现点击事件."onStartShouldSetPanResponderCapture"会在"捕获期"触发事件(即在点击区域的子组件也有手势事件时也会触发该方法),而"onStartShouldSetPanResponder"方法只有在点击区域的子组件没有手势事件时才触发
     2.修复界面其他组件尺寸改变时,该组件没有跟着一起改变自适应尺寸
 */
