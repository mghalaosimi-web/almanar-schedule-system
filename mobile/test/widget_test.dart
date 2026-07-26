import 'package:flutter_test/flutter_test.dart';
import 'package:manar_schedule/main.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const ManarScheduleApp());
    expect(find.byType(ManarScheduleApp), findsOneWidget);
  });
}
