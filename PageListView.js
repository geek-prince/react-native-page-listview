import React, { Component } from 'react';
import {
    Text,
    View,
    ListView,
    FlatList,
    Dimensions,
    PanResponder,
    Animated,
    Easing,
    ActivityIndicator,
} from 'react-native';
let PageList=FlatList||ListView;
//获取屏幕宽高
let {width:w, height:h}=Dimensions.get('window');

//pullState对应的相应的文字说明
const pullStateTextArr={
    'noPull':'',
    'pulling':'下拉刷新...',
    'pullOk':'释放以刷新...',
    'pullRelease':'正在刷新,请稍等...',
};
//默认动画时长
const defaultDuration=400;

export default class PageListView extends Component{
    constructor(props){
        super(props);
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
            width:this.props.width||0,
            height:this.props.height||0,

            //下拉的状态
            pullState:'noPull',
            pullAni:new Animated.Value(-this.props.renderRefreshViewH),
        };
        //创建手势相应者
        this.panResponder = PanResponder.create({
            onMoveShouldSetPanResponder: this.onMoveShouldSetPanResponder,
            onPanResponderMove: this.onPanResponderMove,
            onPanResponderRelease: this.onPanResponderRelease,
            onPanResponderTerminate: this.onPanResponderRelease,
            onShouldBlockNativeResponder: ()=>false
        });
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
        //如果父组件中包含绝对定位的View时传入ListView的高度
        //或者可以在父组件底部加入相应高度的透明View
        height:0,
        // width:0,

        //如果需要在用当前后端返回的数组数据进行处理的话,传入回调函数
        dealWithDataArrCallBack:null,
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
    };

    //取到View自适应的宽高设置给ListView
    onLayout=(event)=>{
        let {width:w, height:h} = event.nativeEvent.layout;
        this.setState({width:w,height:h});
    };

    render() {
        let widthS=this.state.width;
        let heightS=this.state.height;
        return(
            <View style={[heightS&&widthS?{width:widthS,height:heightS}:(heightS?{height:heightS,width:'100%'}:(widthS?{width:widthS,flex:1,}:{flex:1})),{zIndex:-99999}]} onLayout={this.onLayout}>
                <Animated.View ref={aniView=>{this.aniView=aniView}} style={[{transform:[{translateY:this.state.pullAni}]},{width:this.state.width,height:this.state.height+this.props.renderRefreshViewH}]}>
                    {this.props.renderRefreshView?this.props.renderRefreshView(this.state.pullState):this.renderRefreshView()}
                    <View style={[{width:this.state.width,height:this.state.height}]} {...this.panResponder.panHandlers}>
                        {this.renderListView()}
                    </View>
                </Animated.View>
            </View>
        );

    }

    //ListView/FlatList的渲染
    renderListView=()=>{
        if(!this.props.isListView){
            if(this.props.pageLen){
                return(
                    <PageList
                        {...this.props}
                        style={{}}//虽然不需要样式,但必须加,这样才能在视图更新时调用renderFooter方法
                        data={this.state.dataSource}
                        //当接近ListView的底部时的操作
                        onEndReached={this.willReachEnd}
                        //当距离底部多少距离时触发上面的这个方法 注意:在FlatList中此参数是一个比值而非像素单位。比如，0.5表示距离内容最底部的距离为当前列表可见长度的一半时触发
                        onEndReachedThreshold={0.05}
                        //渲染加载更多时,"加载中"的cell
                        ListFooterComponent={this.renderFooter}
                        //渲染每一行的cell怎么样显示
                        renderItem={this.renderItem}
                        keyExtractor={(item,index)=>index.toString()}
                        scrollEnabled={this.state.scrollEnabled}
                        onScroll={this.onScroll}
                        ref={list=>{this.list=list}}
                    />
                );
            }else {
                return(
                    <PageList
                        {...this.props}
                        style={{}}//虽然不需要样式,但必须加,这样才能在视图更新时调用renderFooter方法
                        data={this.state.dataSource}
                        //渲染每一行的cell怎么样显示
                        renderItem={this.renderItem}
                        ItemSeparatorComponent={this.renderItemS}
                        keyExtractor={(item,index)=>index.toString()}
                    />
                );
            }
        }else {
            if(this.props.pageLen){
                return (
                    <PageList
                        {...this.props}
                        style={{}}//虽然不需要样式,但必须加,这样才能在视图更新时调用renderFooter方法
                        dataSource={this.state.dataSource}
                        //当接近ListView的底部时的操作
                        onEndReached={this.willReachEnd}
                        //当距离底部多少距离时触发上面的这个方法
                        onEndReachedThreshold={10}
                        //渲染加载更多时,"加载中"的cell
                        renderFooter={this.renderFooter}
                        //渲染每一行的cell怎么样显示
                        renderRow={this.renderRow}
                        //允许空的组,加上就行(不用管)
                        enableEmptySections={true}
                        scrollEnabled={this.state.scrollEnabled}
                        onScroll={this.onScroll}
                        ref={list=>{this.list=list}}
                    />
                );
            }else {
                return(
                    <PageList
                        {...this.props}
                        style={{}}//虽然不需要样式,但必须加,这样才能在视图更新时调用renderFooter方法
                        dataSource={this.state.dataSource}
                        //渲染每一行的cell怎么样显示
                        renderRow={this.renderRow}
                        //允许空的组,加上就行(不用管)
                        enableEmptySections={true}
                    />
                );
            }
        }
    };

    componentDidMount(){
        this.resetAni();
        this.props.refresh((res)=>{
            let len=res.length;
            this.updateData(res,len);
        });
    }

    //当快要接近底部时加载更多
    willReachEnd=()=> {
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

    //下拉刷新
    refresh=()=>{
        this.props.refresh((res)=>{
            let len=res.length;
            this.updateData(res,len);
            this.setState({page:2,ifShowRefresh:false,pullState:'noPull'});
            this.resetAni()
        });
    };

    //ListView渲染每一行的cell
    renderRow=(rowData,group,index)=>{
        let notLast=parseInt(index)!==this.state.dataArr.length-1;
        let ifRenderItemS=this.props.ItemSeparatorComponent&&((this.props.pageLen&&(this.state.canLoad||notLast))||(!this.props.pageLen&&notLast));
        return (<View>{this.props.renderRow(rowData,index)}{ifRenderItemS&&this.props.ItemSeparatorComponent()}</View>);
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
                    <View style={{alignItems: 'center', justifyContent:'center',height:40,width:w,backgroundColor:'#eee'}}>
                        <Text allowFontScaling={false} style={{color: '#000', fontSize: 12}}>没有更多数据了...</Text>
                    </View>
                );
            }
        } else {
            if(this.props.renderLoadMore){
                return this.props.renderLoadMore();
            }else {
                return (
                    <View style={{alignItems: 'center', justifyContent:'center',height:40,width:w,backgroundColor:'#eee',flexDirection:'row'}}>
                        <ActivityIndicator animating={this.state.isLoadding} color='#333' size='small' style={{marginRight:7}}/>
                        <Text allowFontScaling={false} style={{color: '#000', fontSize: 12,}}>{this.state.isLoadding?'正在加载中,请稍等':'上拉加载更多'}...</Text>
                    </View>
                );
            }
        }
    };

    //更新状态机
    updateData=(res,len,loadMore=false)=>{
        let dataArr=[];
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
            canLoad:this.props.pageLen?(len===this.props.pageLen):false,
        });
    };

    //ListView/FlatList滚动时的方法
    onScroll=(e)=>{
        this.lastListY=e.nativeEvent.contentOffset.y;
        this.lastListY<=0&&this.setState({scrollEnabled:false})
    };
    //开始移动时判断是否设置当前的View为手势响应者
    onMoveShouldSetPanResponder=(e,gesture)=> {
        if(!this.props.pageLen)return false;
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
            <View style={{height:60,width:w,justifyContent:'center',alignItems:'center',backgroundColor:'#eee',flexDirection:'row'}}>
                <ActivityIndicator animating={this.state.pullState==='pullRelease'} color='#333' size='small' style={{marginRight:7}}/>
                <Text allowFontScaling={false} style={{color:'#333',fontSize:15}}>{pullStateTextArr[this.state.pullState]}</Text>
            </View>
        );
    };

}
